-- CPP LIVE: explicit lobby entry, planned stay, person queues, and private -> open conversation mode.

alter table public.live_member_preferences
  add column if not exists live_entered_at timestamptz,
  add column if not exists live_until timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists is_live boolean not null default false;

alter table public.message_thread_contexts
  add column if not exists live_owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists live_mode text not null default 'private';

do $$ begin
  if not exists (select 1 from pg_constraint where conname='message_thread_contexts_live_mode_check') then
    alter table public.message_thread_contexts
      add constraint message_thread_contexts_live_mode_check check (live_mode in ('private','open'));
  end if;
end $$;

alter table public.live_rooms
  add column if not exists access_mode text not null default 'closed',
  add column if not exists source_thread_id uuid references public.message_threads(id) on delete set null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='live_rooms_access_mode_check') then
    alter table public.live_rooms
      add constraint live_rooms_access_mode_check check (access_mode in ('closed','open'));
  end if;
end $$;

alter table public.live_open_talk_queue drop constraint if exists live_open_talk_queue_status_check;
alter table public.live_open_talk_queue add constraint live_open_talk_queue_status_check
  check (status in ('waiting','waitlist','served','cancelled','skipped'));

create unique index if not exists live_person_queue_one_active
  on public.live_open_talk_queue(membership_id,host_user_id,requester_user_id)
  where status in ('waiting','waitlist');

create or replace function public.cpp_live_my_membership_id()
returns uuid language sql stable security definer set search_path=public,pg_temp as $$
  select mm.membership_id
  from public.membership_members mm
  join public.memberships m on m.id=mm.membership_id
  where mm.user_id=auth.uid() and mm.status='active'
    and m.name='CPP' and m.membership_mode='matching'
  order by mm.created_at desc limit 1;
$$;

create or replace function public.cpp_live_enter(p_minutes integer default 60)
returns table(live_until timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_membership_id uuid; v_minutes integer:=greatest(10,least(coalesce(p_minutes,60),240)); v_until timestamptz;
begin
  v_membership_id:=public.cpp_live_my_membership_id();
  if v_membership_id is null then raise exception 'CPP membership required'; end if;
  v_until:=now()+make_interval(mins=>v_minutes);
  insert into public.live_member_preferences(membership_id,user_id,availability,open_talk,live_entered_at,live_until,last_seen_at,is_live,updated_at)
  values(v_membership_id,auth.uid(),'available',false,now(),v_until,now(),true,now())
  on conflict(membership_id,user_id) do update
    set availability='available',live_entered_at=now(),live_until=v_until,last_seen_at=now(),is_live=true,open_talk=false,updated_at=now();
  return query select v_until;
end;
$$;

create or replace function public.cpp_live_heartbeat()
returns timestamptz language plpgsql security definer set search_path=public,pg_temp as $$
declare v_membership_id uuid; v_until timestamptz;
begin
  v_membership_id:=public.cpp_live_my_membership_id();
  if v_membership_id is null then raise exception 'CPP membership required'; end if;
  update public.live_member_preferences set last_seen_at=now(),updated_at=now()
    where membership_id=v_membership_id and user_id=auth.uid() and is_live=true
    returning live_until into v_until;
  return v_until;
end;
$$;

create or replace function public.cpp_live_leave()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_membership_id uuid;
begin
  v_membership_id:=public.cpp_live_my_membership_id();
  if v_membership_id is null then return; end if;
  update public.live_member_preferences set is_live=false,last_seen_at=now(),updated_at=now()
    where membership_id=v_membership_id and user_id=auth.uid();
  update public.live_open_talk_queue set status='cancelled',resolved_at=now()
    where membership_id=v_membership_id and status in ('waiting','waitlist')
      and (host_user_id=auth.uid() or requester_user_id=auth.uid());
end;
$$;

create or replace function public.cpp_live_extend_stay(p_minutes integer default 30)
returns timestamptz language plpgsql security definer set search_path=public,pg_temp as $$
declare v_membership_id uuid; v_until timestamptz; v_capacity integer; v_waiting integer;
begin
  v_membership_id:=public.cpp_live_my_membership_id();
  if v_membership_id is null then raise exception 'CPP membership required'; end if;
  update public.live_member_preferences
    set live_until=greatest(coalesce(live_until,now()),now())+make_interval(mins=>greatest(10,least(coalesce(p_minutes,30),120))),
        last_seen_at=now(),updated_at=now()
    where membership_id=v_membership_id and user_id=auth.uid() and is_live=true
    returning live_until into v_until;
  if v_until is null then raise exception 'Enter LIVE first'; end if;
  v_capacity:=greatest(0,floor(extract(epoch from (v_until-now()))/600)::int);
  select count(*)::int into v_waiting from public.live_open_talk_queue q
    where q.membership_id=v_membership_id and q.host_user_id=auth.uid() and q.status='waiting';
  with promote as (
    select q.id from public.live_open_talk_queue q
    where q.membership_id=v_membership_id and q.host_user_id=auth.uid() and q.status='waitlist'
    order by q.created_at,q.id limit greatest(0,v_capacity-v_waiting)
  )
  update public.live_open_talk_queue q set status='waiting' from promote p where q.id=p.id;
  return v_until;
end;
$$;

create or replace function public.cpp_live_lobby_count()
returns integer language sql stable security definer set search_path=public,pg_temp as $$
  with mine as (select public.cpp_live_my_membership_id() membership_id)
  select count(*)::int
  from public.live_member_preferences p,mine m
  where p.membership_id=m.membership_id and p.is_live=true
    and p.live_until>now() and p.last_seen_at>now()-interval '2 minutes';
$$;

create or replace function public.cpp_live_session_state()
returns table(is_live boolean,availability text,live_entered_at timestamptz,live_until timestamptz,remaining_seconds integer)
language sql stable security definer set search_path=public,pg_temp as $$
  with mine as (select public.cpp_live_my_membership_id() membership_id)
  select coalesce(p.is_live,false),coalesce(p.availability,'available'),p.live_entered_at,p.live_until,
    greatest(0,coalesce(floor(extract(epoch from (p.live_until-now())))::int,0))
  from mine m left join public.live_member_preferences p
    on p.membership_id=m.membership_id and p.user_id=auth.uid();
$$;

create or replace function public.cpp_live_join_person_queue(p_target_user_id uuid)
returns table(queue_id uuid,queue_status text,queue_position integer)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_membership_id uuid; v_until timestamptz; v_capacity integer; v_confirmed integer; v_id uuid; v_status text; v_pos integer;
begin
  if p_target_user_id is null or p_target_user_id=auth.uid() then raise exception 'Invalid target'; end if;
  v_membership_id:=public.cpp_live_my_membership_id();
  if v_membership_id is null then raise exception 'CPP membership required'; end if;
  if not exists(select 1 from public.membership_members mm where mm.membership_id=v_membership_id and mm.user_id=p_target_user_id and mm.status='active') then raise exception 'Target is not in CPP'; end if;
  select p.live_until into v_until from public.live_member_preferences p
    where p.membership_id=v_membership_id and p.user_id=p_target_user_id and p.is_live=true
      and p.last_seen_at>now()-interval '2 minutes' and p.live_until>now();
  if v_until is null then raise exception 'Target is not currently in LIVE'; end if;
  select q.id,q.status into v_id,v_status from public.live_open_talk_queue q
    where q.membership_id=v_membership_id and q.host_user_id=p_target_user_id
      and q.requester_user_id=auth.uid() and q.status in ('waiting','waitlist') limit 1;
  if v_id is null then
    v_capacity:=greatest(0,floor(extract(epoch from (v_until-now()))/600)::int);
    select count(*)::int into v_confirmed from public.live_open_talk_queue q
      where q.membership_id=v_membership_id and q.host_user_id=p_target_user_id and q.status='waiting';
    v_status:=case when v_confirmed<v_capacity then 'waiting' else 'waitlist' end;
    insert into public.live_open_talk_queue(membership_id,host_user_id,requester_user_id,status)
      values(v_membership_id,p_target_user_id,auth.uid(),v_status) returning id into v_id;
  end if;
  select count(*)::int into v_pos from public.live_open_talk_queue q
    where q.membership_id=v_membership_id and q.host_user_id=p_target_user_id and q.status=v_status
      and (q.created_at,q.id) <= (select created_at,id from public.live_open_talk_queue where id=v_id);
  return query select v_id,v_status,v_pos;
end;
$$;

create or replace function public.cpp_live_cancel_person_queue(p_queue_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.live_open_talk_queue set status='cancelled',resolved_at=now()
  where id=p_queue_id and requester_user_id=auth.uid() and status in ('waiting','waitlist');
end;
$$;

create or replace function public.cpp_live_queue_snapshot()
returns table(queue_id uuid,host_user_id uuid,requester_user_id uuid,queue_status text,queue_position integer,display_name text)
language sql stable security definer set search_path=public,pg_temp as $$
  with mine as (select public.cpp_live_my_membership_id() membership_id), q as (
    select x.*,row_number() over(partition by x.host_user_id,x.status order by x.created_at,x.id)::int pos
    from public.live_open_talk_queue x,mine m
    where x.membership_id=m.membership_id and x.status in ('waiting','waitlist')
  )
  select q.id,q.host_user_id,q.requester_user_id,q.status,q.pos,
    coalesce(nullif(sp.display_name,''),nullif(p.display_name,''),nullif(p.username,''),'PARARI USER')
  from q
  left join public.parari_social_profiles sp on sp.user_id=q.requester_user_id
  left join public.profiles p on p.user_id=q.requester_user_id
  order by q.host_user_id,q.status,q.pos;
$$;

create or replace function public.cpp_live_respond_conversation(p_request_id uuid,p_accept boolean)
returns table(request_id uuid,request_status text,thread_id uuid)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_me uuid:=auth.uid(); v_req public.matching_conversation_requests%rowtype; v_thread_id uuid; v_request_id uuid; v_request_status text;
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  select r.* into v_req from public.matching_conversation_requests r where r.id=p_request_id for update;
  if v_req.id is null then raise exception 'Request not found'; end if;
  if v_req.target_user_id<>v_me then raise exception 'Not allowed'; end if;
  if v_req.status<>'pending' then return query select v_req.id,v_req.status,v_req.thread_id; return; end if;
  if not exists(select 1 from public.membership_members mm where mm.membership_id=v_req.membership_id and mm.user_id=v_me and mm.status='active') then raise exception 'CPP membership required'; end if;
  if not p_accept then
    update public.matching_conversation_requests r set status='declined',responded_at=now()
    where r.id=v_req.id returning r.id,r.status,r.thread_id into v_request_id,v_request_status,v_thread_id;
    return query select v_request_id,v_request_status,v_thread_id; return;
  end if;
  if public.cpp_live_is_user_busy(v_req.membership_id,v_me) then raise exception 'Finish your current conversation first'; end if;
  if public.cpp_live_is_user_busy(v_req.membership_id,v_req.requester_user_id) then raise exception 'The other person is currently in another conversation'; end if;
  v_thread_id:=public.cpp_live_start_direct_internal(v_req.membership_id,v_req.requester_user_id,v_req.target_user_id);
  update public.message_thread_contexts c set live_owner_user_id=v_req.target_user_id,live_mode='private'
    where c.thread_id=v_thread_id and c.context_type='membership' and c.context_id=v_req.membership_id;
  update public.matching_conversation_requests r set status='accepted',responded_at=now(),thread_id=v_thread_id
    where r.id=v_req.id returning r.id,r.status into v_request_id,v_request_status;
  update public.matching_conversation_requests r set status='cancelled',responded_at=now()
    where r.membership_id=v_req.membership_id and r.status='pending' and r.id<>v_req.id
      and ((r.requester_user_id=v_req.requester_user_id and r.target_user_id=v_req.target_user_id)
        or (r.requester_user_id=v_req.target_user_id and r.target_user_id=v_req.requester_user_id));
  return query select v_request_id,v_request_status,v_thread_id;
end;
$$;

create or replace function public.cpp_live_open_direct_conversation(p_thread_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_membership_id uuid; v_owner uuid; v_a uuid; v_b uuid; v_room uuid;
begin
  select c.context_id,c.live_owner_user_id,mt.user_a_id,mt.user_b_id into v_membership_id,v_owner,v_a,v_b
  from public.message_thread_contexts c join public.message_threads mt on mt.id=c.thread_id
  where c.thread_id=p_thread_id and c.context_type='membership'
    and c.relationship_type='matching_live_direct' and c.status='active'
  limit 1 for update of c;
  if v_membership_id is null then raise exception 'Conversation not found'; end if;
  if v_owner is distinct from auth.uid() then raise exception 'Only the person who was approached can open this conversation'; end if;
  insert into public.live_rooms(membership_id,created_by,room_type,status,access_mode,source_thread_id)
    values(v_membership_id,auth.uid(),'group','active','open',p_thread_id) returning id into v_room;
  insert into public.live_room_members(room_id,user_id,role,status,responded_at)
    values(v_room,v_owner,'host','active',now()),
      (v_room,case when v_a=v_owner then v_b else v_a end,'member','active',now());
  update public.message_thread_contexts set status='ended',ended_at=now(),live_mode='open'
    where thread_id=p_thread_id and context_type='membership' and context_id=v_membership_id;
  return v_room;
end;
$$;

create or replace function public.cpp_live_join_open_room(p_room_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_membership_id uuid;
begin
  select r.membership_id into v_membership_id from public.live_rooms r
    where r.id=p_room_id and r.status='active' and r.access_mode='open';
  if v_membership_id is null then raise exception 'OPEN conversation not found'; end if;
  if not exists(select 1 from public.membership_members mm where mm.membership_id=v_membership_id and mm.user_id=auth.uid() and mm.status='active') then raise exception 'CPP membership required'; end if;
  if public.cpp_live_is_user_busy(v_membership_id,auth.uid()) then raise exception 'Finish your current conversation first'; end if;
  insert into public.live_room_members(room_id,user_id,role,status,responded_at)
    values(p_room_id,auth.uid(),'member','active',now())
  on conflict(room_id,user_id) do update set status='active',responded_at=now();
end;
$$;

create or replace function public.cpp_live_conversation_map()
returns table(conversation_id uuid,conversation_kind text,conversation_mode text,owner_user_id uuid,participant_ids uuid[],session_expires_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
  with mine as (select public.cpp_live_my_membership_id() membership_id), direct as (
    select mt.id,'direct'::text,'private'::text,c.live_owner_user_id,
      array[mt.user_a_id,mt.user_b_id]::uuid[],c.session_expires_at
    from public.message_thread_contexts c
    join public.message_threads mt on mt.id=c.thread_id
    join mine m on m.membership_id=c.context_id
    where c.context_type='membership' and c.relationship_type='matching_live_direct'
      and c.status='active' and (c.session_expires_at is null or c.session_expires_at>now())
  ), rooms as (
    select r.id,'room'::text,case when r.access_mode='open' then 'open' else 'private' end,
      r.created_by,array_agg(rm.user_id order by rm.invited_at,rm.user_id)::uuid[],null::timestamptz
    from public.live_rooms r
    join mine m on m.membership_id=r.membership_id
    join public.live_room_members rm on rm.room_id=r.id and rm.status='active'
    where r.status='active'
    group by r.id,r.access_mode,r.created_by having count(*)>=2
  )
  select * from direct union all select * from rooms;
$$;

create or replace function public.cpp_live_room_for_user(p_user_id uuid)
returns table(room_id uuid,access_mode text)
language sql stable security definer set search_path=public,pg_temp as $$
  with mine as (select public.cpp_live_my_membership_id() membership_id)
  select r.id,r.access_mode
  from public.live_rooms r
  join mine m on m.membership_id=r.membership_id
  join public.live_room_members rm on rm.room_id=r.id and rm.user_id=p_user_id and rm.status='active'
  where r.status='active' order by r.created_at desc limit 1;
$$;

drop function if exists public.cpp_live_active_threads_timed();
create function public.cpp_live_active_threads_timed()
returns table(thread_id uuid,other_user_id uuid,display_name text,photo_url text,affiliation text,role_title text,organization_key text,last_message_at timestamptz,last_message_body text,session_started_at timestamptz,session_expires_at timestamptz,extension_count integer,live_owner_user_id uuid,live_mode text,waiting_count integer)
language sql stable security definer set search_path=public,pg_temp as $$
  with mine as (select public.cpp_live_my_membership_id() membership_id), threads as (
    select mt.*,c.session_started_at,c.session_expires_at,c.extension_count,c.live_owner_user_id,c.live_mode,
      case when mt.user_a_id=auth.uid() then mt.user_b_id else mt.user_a_id end other_user_id,c.context_id
    from public.message_threads mt
    join public.message_thread_contexts c on c.thread_id=mt.id
    join mine m on m.membership_id=c.context_id
    where c.context_type='membership' and c.relationship_type='matching_live_direct'
      and c.status='active' and (c.session_expires_at is null or c.session_expires_at>now())
      and (mt.user_a_id=auth.uid() or mt.user_b_id=auth.uid())
  )
  select t.id,t.other_user_id,
    coalesce(nullif(sp.display_name,''),nullif(p.display_name,''),nullif(p.username,''),'PARARI USER'),
    coalesce(sp.photo_url,p.avatar_url),sp.affiliation,sp.role_title,org.organization_key,
    t.last_message_at,t.last_message_body,t.session_started_at,t.session_expires_at,t.extension_count,
    t.live_owner_user_id,t.live_mode,
    (select count(*)::int from public.live_open_talk_queue q
      where q.membership_id=t.context_id and q.host_user_id=auth.uid() and q.status='waiting')
  from threads t
  join public.membership_members mm on mm.membership_id=t.context_id and mm.user_id=t.other_user_id and mm.status='active'
  left join public.membership_organizations org on org.id=mm.organization_id
  left join public.parari_social_profiles sp on sp.user_id=t.other_user_id
  left join public.profiles p on p.user_id=t.other_user_id
  order by coalesce(t.last_message_at,t.updated_at) desc;
$$;

revoke all on function public.cpp_live_enter(integer) from public;
revoke all on function public.cpp_live_heartbeat() from public;
revoke all on function public.cpp_live_leave() from public;
revoke all on function public.cpp_live_extend_stay(integer) from public;
revoke all on function public.cpp_live_lobby_count() from public;
revoke all on function public.cpp_live_session_state() from public;
revoke all on function public.cpp_live_join_person_queue(uuid) from public;
revoke all on function public.cpp_live_cancel_person_queue(uuid) from public;
revoke all on function public.cpp_live_queue_snapshot() from public;
revoke all on function public.cpp_live_open_direct_conversation(uuid) from public;
revoke all on function public.cpp_live_join_open_room(uuid) from public;
revoke all on function public.cpp_live_conversation_map() from public;
revoke all on function public.cpp_live_room_for_user(uuid) from public;

grant execute on function public.cpp_live_enter(integer) to authenticated;
grant execute on function public.cpp_live_heartbeat() to authenticated;
grant execute on function public.cpp_live_leave() to authenticated;
grant execute on function public.cpp_live_extend_stay(integer) to authenticated;
grant execute on function public.cpp_live_lobby_count() to authenticated;
grant execute on function public.cpp_live_session_state() to authenticated;
grant execute on function public.cpp_live_join_person_queue(uuid) to authenticated;
grant execute on function public.cpp_live_cancel_person_queue(uuid) to authenticated;
grant execute on function public.cpp_live_queue_snapshot() to authenticated;
grant execute on function public.cpp_live_open_direct_conversation(uuid) to authenticated;
grant execute on function public.cpp_live_join_open_room(uuid) to authenticated;
grant execute on function public.cpp_live_conversation_map() to authenticated;
grant execute on function public.cpp_live_room_for_user(uuid) to authenticated;
grant execute on function public.cpp_live_active_threads_timed() to authenticated;
