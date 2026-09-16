update public.live_member_preferences
set availability='available', updated_at=now()
where availability='observe';

alter table public.live_member_preferences
  drop constraint if exists live_member_preferences_availability_check;

alter table public.live_member_preferences
  add constraint live_member_preferences_availability_check
  check (availability in ('available','away'));

create or replace function public.cpp_live_enter_as(
  p_minutes integer default 60,
  p_availability text default 'available'
)
returns table(live_until timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_membership_id uuid;
  v_minutes integer:=greatest(10,least(coalesce(p_minutes,60),240));
  v_until timestamptz;
begin
  if coalesce(p_availability,'available') <> 'available' then
    raise exception 'LIVE entry starts as available';
  end if;

  v_membership_id:=public.cpp_live_my_membership_id();
  if v_membership_id is null then raise exception 'CPP membership required'; end if;

  v_until:=now()+make_interval(mins=>v_minutes);
  insert into public.live_member_preferences(
    membership_id,user_id,availability,open_talk,live_entered_at,live_until,last_seen_at,is_live,updated_at
  ) values(
    v_membership_id,auth.uid(),'available',false,now(),v_until,now(),true,now()
  )
  on conflict(membership_id,user_id)
  do update set availability='available',live_entered_at=now(),live_until=v_until,last_seen_at=now(),is_live=true,open_talk=false,updated_at=now();

  return query select v_until;
end;
$$;

create or replace function public.cpp_live_set_availability(p_availability text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_membership_id uuid;
begin
  if p_availability not in ('available','away') then
    raise exception 'Invalid availability';
  end if;

  select mm.membership_id into v_membership_id
  from public.membership_members mm
  join public.memberships m on m.id=mm.membership_id
  where mm.user_id=auth.uid()
    and mm.status='active'
    and m.name='CPP'
    and m.membership_mode='matching'
  order by mm.created_at desc
  limit 1;

  if v_membership_id is null then raise exception 'CPP membership required'; end if;

  insert into public.live_member_preferences(membership_id,user_id,availability,updated_at)
  values(v_membership_id,auth.uid(),p_availability,now())
  on conflict(membership_id,user_id)
  do update set availability=excluded.availability,updated_at=now();
end;
$$;

create or replace function public.cpp_live_request_conversation(p_target_user_id uuid)
returns table(request_id uuid, request_status text, thread_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_membership_id uuid;
  v_existing_request public.matching_conversation_requests%rowtype;
  v_thread_id uuid;
  v_request_id uuid;
  v_request_status text;
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if p_target_user_id is null or p_target_user_id = v_me then raise exception 'Invalid target'; end if;

  select mm.membership_id into v_membership_id
  from public.membership_members mm
  join public.memberships m on m.id = mm.membership_id
  where mm.user_id = v_me
    and mm.status = 'active'
    and m.name = 'CPP'
    and m.membership_mode = 'matching'
  order by mm.created_at desc
  limit 1;

  if v_membership_id is null then raise exception 'CPP membership required'; end if;

  if not exists (
    select 1
    from public.membership_members mm
    join public.live_member_preferences lp
      on lp.membership_id=mm.membership_id and lp.user_id=mm.user_id
    where mm.membership_id = v_membership_id
      and mm.user_id = p_target_user_id
      and mm.status = 'active'
      and lp.is_live=true
      and lp.live_until>now()
      and lp.last_seen_at>now()-interval '2 minutes'
  ) then
    raise exception 'Target is not currently in CPP LIVE';
  end if;

  select mt.id into v_thread_id
  from public.message_threads mt
  join public.message_thread_contexts c
    on c.thread_id = mt.id
   and c.context_type = 'membership'
   and c.context_id = v_membership_id
   and c.relationship_type = 'matching_live_direct'
   and c.status = 'active'
  where (mt.user_a_id = v_me and mt.user_b_id = p_target_user_id)
     or (mt.user_a_id = p_target_user_id and mt.user_b_id = v_me)
  limit 1;

  if v_thread_id is not null then
    return query select null::uuid, 'accepted'::text, v_thread_id;
    return;
  end if;

  select r.* into v_existing_request
  from public.matching_conversation_requests r
  where r.membership_id = v_membership_id
    and r.requester_user_id = v_me
    and r.target_user_id = p_target_user_id
    and r.status = 'pending'
  order by r.created_at desc
  limit 1;

  if v_existing_request.id is not null then
    return query select v_existing_request.id, v_existing_request.status, v_existing_request.thread_id;
    return;
  end if;

  insert into public.matching_conversation_requests as r (membership_id, requester_user_id, target_user_id)
  values (v_membership_id, v_me, p_target_user_id)
  returning r.id, r.status, r.thread_id into v_request_id, v_request_status, v_thread_id;

  return query select v_request_id, v_request_status, v_thread_id;
end;
$$;

revoke all on function public.cpp_live_enter_as(integer,text) from public;
grant execute on function public.cpp_live_enter_as(integer,text) to authenticated;
revoke all on function public.cpp_live_set_availability(text) from public;
grant execute on function public.cpp_live_set_availability(text) to authenticated;
revoke all on function public.cpp_live_request_conversation(uuid) from public;
grant execute on function public.cpp_live_request_conversation(uuid) to authenticated;
