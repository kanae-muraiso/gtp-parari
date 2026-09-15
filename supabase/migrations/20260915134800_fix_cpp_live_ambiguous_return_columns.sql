create or replace function public.cpp_live_request_conversation(p_target_user_id uuid)
returns table(request_id uuid, request_status text, thread_id uuid)
language plpgsql
security definer
set search_path to 'public','pg_temp'
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
    select 1 from public.membership_members mm
    where mm.membership_id = v_membership_id
      and mm.user_id = p_target_user_id
      and mm.status = 'active'
  ) then
    raise exception 'Target is not an active CPP member';
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

create or replace function public.cpp_live_respond_conversation(p_request_id uuid, p_accept boolean)
returns table(request_id uuid, request_status text, thread_id uuid)
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_req public.matching_conversation_requests%rowtype;
  v_a uuid;
  v_b uuid;
  v_thread_id uuid;
  v_request_id uuid;
  v_request_status text;
begin
  if v_me is null then raise exception 'Authentication required'; end if;

  select r.* into v_req
  from public.matching_conversation_requests r
  where r.id = p_request_id
  for update;

  if v_req.id is null then raise exception 'Request not found'; end if;
  if v_req.target_user_id <> v_me then raise exception 'Not allowed'; end if;
  if v_req.status <> 'pending' then
    return query select v_req.id, v_req.status, v_req.thread_id;
    return;
  end if;

  if not exists (
    select 1 from public.membership_members mm
    where mm.membership_id = v_req.membership_id
      and mm.user_id = v_me
      and mm.status = 'active'
  ) then raise exception 'CPP membership required'; end if;

  if not p_accept then
    update public.matching_conversation_requests as r
    set status = 'declined', responded_at = now()
    where r.id = v_req.id
    returning r.id, r.status, r.thread_id into v_request_id, v_request_status, v_thread_id;

    return query select v_request_id, v_request_status, v_thread_id;
    return;
  end if;

  if v_req.requester_user_id::text < v_req.target_user_id::text then
    v_a := v_req.requester_user_id;
    v_b := v_req.target_user_id;
  else
    v_a := v_req.target_user_id;
    v_b := v_req.requester_user_id;
  end if;

  insert into public.message_threads as mt (user_a_id, user_b_id)
  values (v_a, v_b)
  on conflict (user_a_id, user_b_id) do update
    set updated_at = now()
  returning mt.id into v_thread_id;

  insert into public.message_thread_contexts(
    thread_id, context_type, context_id, relationship_type, status, user_a_role, user_b_role
  ) values (
    v_thread_id, 'membership', v_req.membership_id, 'matching_live_direct', 'active', 'member', 'member'
  )
  on conflict on constraint message_thread_contexts_unique_source do update
    set relationship_type = 'matching_live_direct', status = 'active', ended_at = null;

  update public.matching_conversation_requests as r
  set status = 'accepted', responded_at = now(), thread_id = v_thread_id
  where r.id = v_req.id
  returning r.id, r.status, r.thread_id into v_request_id, v_request_status, v_thread_id;

  update public.matching_conversation_requests as r
  set status = 'cancelled', responded_at = now()
  where r.membership_id = v_req.membership_id
    and r.status = 'pending'
    and r.id <> v_req.id
    and ((r.requester_user_id = v_req.requester_user_id and r.target_user_id = v_req.target_user_id)
      or (r.requester_user_id = v_req.target_user_id and r.target_user_id = v_req.requester_user_id));

  return query select v_request_id, v_request_status, v_thread_id;
end;
$$;

create or replace function public.cpp_live_send_message(p_thread_id uuid, p_body text)
returns table(message_id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_body text := btrim(coalesce(p_body,''));
  v_message_id uuid;
  v_created_at timestamptz;
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then raise exception 'Message must be 1-2000 characters'; end if;

  if not exists (
    select 1
    from public.message_threads mt
    join public.message_thread_contexts c on c.thread_id = mt.id
    join public.memberships m on m.id = c.context_id
    join public.membership_members mm on mm.membership_id = m.id and mm.user_id = v_me and mm.status = 'active'
    where mt.id = p_thread_id
      and (mt.user_a_id = v_me or mt.user_b_id = v_me)
      and c.context_type = 'membership'
      and c.relationship_type = 'matching_live_direct'
      and c.status = 'active'
      and m.name = 'CPP'
      and m.membership_mode = 'matching'
  ) then raise exception 'Not allowed'; end if;

  insert into public.messages as msg (thread_id, sender_user_id, body)
  values (p_thread_id, v_me, v_body)
  returning msg.id, msg.created_at into v_message_id, v_created_at;

  update public.message_threads as mt
  set updated_at = now(),
      last_message_at = v_created_at,
      last_message_body = v_body,
      last_sender_user_id = v_me
  where mt.id = p_thread_id;

  return query select v_message_id, v_created_at;
end;
$$;
