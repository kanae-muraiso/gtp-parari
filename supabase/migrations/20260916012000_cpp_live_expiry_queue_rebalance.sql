-- CPP LIVE: robust 10-minute expiry and person queue promotion.

create or replace function public.cpp_live_initialize_session_timing()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  if new.relationship_type='matching_live_direct' and new.status='active' then
    if tg_op='INSERT'
       or old.status is distinct from 'active'
       or new.session_expires_at is null
       or new.session_expires_at <= now() then
      new.session_started_at:=now();
      new.session_expires_at:=now()+interval '10 minutes';
      new.extension_count:=0;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.cpp_live_rebalance_person_queue(p_host_user_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_membership_id uuid;
  v_until timestamptz;
  v_capacity integer;
  v_waiting integer;
begin
  v_membership_id:=public.cpp_live_my_membership_id();
  if v_membership_id is null then return; end if;
  select p.live_until into v_until
  from public.live_member_preferences p
  where p.membership_id=v_membership_id and p.user_id=p_host_user_id
    and p.is_live=true and p.live_until>now();
  if v_until is null then return; end if;
  v_capacity:=greatest(0,floor(extract(epoch from (v_until-now()))/600)::int);
  select count(*)::int into v_waiting
  from public.live_open_talk_queue q
  where q.membership_id=v_membership_id and q.host_user_id=p_host_user_id and q.status='waiting';
  with promote as (
    select q.id
    from public.live_open_talk_queue q
    where q.membership_id=v_membership_id and q.host_user_id=p_host_user_id and q.status='waitlist'
    order by q.created_at,q.id
    limit greatest(0,v_capacity-v_waiting)
  )
  update public.live_open_talk_queue q set status='waiting'
  from promote p where q.id=p.id;
end;
$$;

create or replace function public.cpp_live_cancel_person_queue(p_queue_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_host uuid;
begin
  select q.host_user_id into v_host
  from public.live_open_talk_queue q
  where q.id=p_queue_id and q.requester_user_id=auth.uid() and q.status in ('waiting','waitlist');
  update public.live_open_talk_queue q
  set status='cancelled',resolved_at=now()
  where q.id=p_queue_id and q.requester_user_id=auth.uid() and q.status in ('waiting','waitlist');
  if v_host is not null then perform public.cpp_live_rebalance_person_queue(v_host); end if;
end;
$$;

create or replace function public.cpp_live_start_next_waiting()
returns table(thread_id uuid,requester_user_id uuid,display_name text)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_membership_id uuid;
  v_q public.live_open_talk_queue%rowtype;
  v_thread uuid;
  v_name text;
begin
  v_membership_id:=public.cpp_live_my_membership_id();
  if v_membership_id is null then raise exception 'CPP membership required'; end if;
  if public.cpp_live_is_user_busy(v_membership_id,auth.uid()) then raise exception 'Finish your current conversation first'; end if;
  select q.* into v_q
  from public.live_open_talk_queue q
  where q.membership_id=v_membership_id and q.host_user_id=auth.uid() and q.status='waiting'
  order by q.created_at,q.id limit 1 for update;
  if v_q.id is null then raise exception 'No confirmed waiting member'; end if;
  if public.cpp_live_is_user_busy(v_membership_id,v_q.requester_user_id) then raise exception 'The next person is currently in another conversation'; end if;
  if not exists(
    select 1 from public.live_member_preferences p
    where p.membership_id=v_membership_id and p.user_id=v_q.requester_user_id
      and p.is_live=true and p.live_until>now() and p.last_seen_at>now()-interval '2 minutes'
  ) then
    update public.live_open_talk_queue q set status='skipped',resolved_at=now() where q.id=v_q.id;
    perform public.cpp_live_rebalance_person_queue(auth.uid());
    raise exception 'The next person is no longer available in LIVE';
  end if;
  v_thread:=public.cpp_live_start_direct_internal(v_membership_id,auth.uid(),v_q.requester_user_id);
  update public.message_thread_contexts c
  set live_owner_user_id=auth.uid(),live_mode='private'
  where c.thread_id=v_thread and c.context_type='membership' and c.context_id=v_membership_id;
  update public.live_open_talk_queue q set status='served',resolved_at=now() where q.id=v_q.id;
  perform public.cpp_live_rebalance_person_queue(auth.uid());
  select coalesce(nullif(sp.display_name,''),nullif(p.display_name,''),nullif(p.username,''),'PARARI USER')
  into v_name
  from auth.users u
  left join public.parari_social_profiles sp on sp.user_id=u.id
  left join public.profiles p on p.user_id=u.id
  where u.id=v_q.requester_user_id;
  return query select v_thread,v_q.requester_user_id,v_name;
end;
$$;

create or replace function public.cpp_live_extend_conversation(p_thread_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_me uuid:=auth.uid();
  v_context_id uuid;
  v_context_membership uuid;
  v_a uuid;
  v_b uuid;
  v_new_expires timestamptz;
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  select c.id,c.context_id,mt.user_a_id,mt.user_b_id
  into v_context_id,v_context_membership,v_a,v_b
  from public.message_threads mt
  join public.message_thread_contexts c on c.thread_id=mt.id
  join public.memberships m on m.id=c.context_id
  join public.membership_members mm on mm.membership_id=m.id and mm.user_id=v_me and mm.status='active'
  where mt.id=p_thread_id and (mt.user_a_id=v_me or mt.user_b_id=v_me)
    and c.context_type='membership' and c.relationship_type='matching_live_direct'
    and c.status='active' and c.session_expires_at>now() and c.extension_count<1
    and m.name='CPP' and m.membership_mode='matching'
  limit 1 for update of c;
  if v_context_id is null then raise exception 'This conversation cannot be extended'; end if;
  if exists(
    select 1 from public.live_open_talk_queue q
    where q.membership_id=v_context_membership and q.host_user_id in (v_a,v_b) and q.status='waiting'
  ) then
    raise exception 'A confirmed waiting member exists, so this conversation cannot be extended';
  end if;
  update public.message_thread_contexts c
  set session_expires_at=c.session_expires_at+interval '5 minutes',
      extension_count=c.extension_count+1
  where c.id=v_context_id
  returning c.session_expires_at into v_new_expires;
  return v_new_expires;
end;
$$;

create or replace function public.cpp_live_send_message(p_thread_id uuid,p_body text)
returns table(message_id uuid,created_at timestamptz)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_me uuid:=auth.uid();
  v_body text:=btrim(coalesce(p_body,''));
  v_message_id uuid;
  v_created_at timestamptz;
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if char_length(v_body)<1 or char_length(v_body)>2000 then raise exception 'Message must be 1-2000 characters'; end if;
  if not exists(
    select 1
    from public.message_threads mt
    join public.message_thread_contexts c on c.thread_id=mt.id
    join public.memberships m on m.id=c.context_id
    join public.membership_members mm on mm.membership_id=m.id and mm.user_id=v_me and mm.status='active'
    where mt.id=p_thread_id and (mt.user_a_id=v_me or mt.user_b_id=v_me)
      and c.context_type='membership' and c.relationship_type='matching_live_direct'
      and c.status='active' and (c.session_expires_at is null or c.session_expires_at>now())
      and m.name='CPP' and m.membership_mode='matching'
  ) then
    raise exception 'This LIVE conversation is no longer active';
  end if;
  insert into public.messages as msg(thread_id,sender_user_id,body)
  values(p_thread_id,v_me,v_body)
  returning msg.id,msg.created_at into v_message_id,v_created_at;
  update public.message_threads mt
  set updated_at=now(),last_message_at=v_created_at,last_message_body=v_body,last_sender_user_id=v_me
  where mt.id=p_thread_id;
  return query select v_message_id,v_created_at;
end;
$$;

revoke all on function public.cpp_live_rebalance_person_queue(uuid) from public;
grant execute on function public.cpp_live_rebalance_person_queue(uuid) to authenticated;
