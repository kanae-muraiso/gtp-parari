create or replace function public.cpp_live_request_conversation(p_target_user_id uuid)
returns table(request_id uuid, request_status text, thread_id uuid)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_membership_id uuid;
  v_existing_request public.matching_conversation_requests%rowtype;
  v_thread_id uuid;
  v_request_id uuid;
  v_request_status text;
  v_my_availability text;
  v_target_availability text;
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

  select p.availability into v_my_availability
  from public.live_member_preferences p
  where p.membership_id=v_membership_id
    and p.user_id=v_me
    and p.is_live=true
    and p.live_until>now()
    and p.last_seen_at>now()-interval '2 minutes';

  if coalesce(v_my_availability,'away') <> 'available' then
    raise exception '「話せます」の状態にしてから話しかけてください';
  end if;

  select p.availability into v_target_availability
  from public.live_member_preferences p
  where p.membership_id=v_membership_id
    and p.user_id=p_target_user_id
    and p.is_live=true
    and p.live_until>now()
    and p.last_seen_at>now()-interval '2 minutes';

  if coalesce(v_target_availability,'away') <> 'available' then
    raise exception '相手は現在「話せます」の状態ではありません';
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
