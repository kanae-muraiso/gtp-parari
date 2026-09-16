create or replace function public.cpp_live_respond_conversation(p_request_id uuid, p_accept boolean)
returns table(request_id uuid, request_status text, thread_id uuid)
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_me uuid:=auth.uid();
  v_req public.matching_conversation_requests%rowtype;
  v_thread_id uuid;
  v_request_id uuid;
  v_request_status text;
begin
  if v_me is null then raise exception 'Authentication required'; end if;

  select r.* into v_req
  from public.matching_conversation_requests r
  where r.id=p_request_id
  for update;

  if v_req.id is null then raise exception 'Request not found'; end if;
  if v_req.target_user_id<>v_me then raise exception 'Not allowed'; end if;

  if v_req.status<>'pending' then
    return query select v_req.id,v_req.status,v_req.thread_id;
    return;
  end if;

  if not exists(
    select 1
    from public.membership_members mm
    where mm.membership_id=v_req.membership_id
      and mm.user_id=v_me
      and mm.status='active'
  ) then
    raise exception 'CPP membership required';
  end if;

  if not p_accept then
    update public.matching_conversation_requests r
    set status='declined', responded_at=now()
    where r.id=v_req.id
    returning r.id,r.status,r.thread_id
      into v_request_id,v_request_status,v_thread_id;

    return query select v_request_id,v_request_status,v_thread_id;
    return;
  end if;

  if public.cpp_live_is_user_busy(v_req.membership_id,v_me) then
    raise exception 'Finish your current conversation first';
  end if;

  if public.cpp_live_is_user_busy(v_req.membership_id,v_req.requester_user_id) then
    raise exception 'The other person is currently in another conversation';
  end if;

  v_thread_id:=public.cpp_live_start_direct_internal(
    v_req.membership_id,
    v_req.requester_user_id,
    v_req.target_user_id
  );

  update public.message_thread_contexts c
  set live_owner_user_id=v_req.target_user_id,
      live_mode='private'
  where c.thread_id=v_thread_id
    and c.context_type='membership'
    and c.context_id=v_req.membership_id;

  update public.matching_conversation_requests r
  set status='accepted', responded_at=now(), thread_id=v_thread_id
  where r.id=v_req.id
  returning r.id,r.status into v_request_id,v_request_status;

  update public.matching_conversation_requests r
  set status='cancelled', responded_at=now()
  where r.membership_id=v_req.membership_id
    and r.status='pending'
    and r.id<>v_req.id
    and (
      (r.requester_user_id=v_req.requester_user_id and r.target_user_id=v_req.target_user_id)
      or
      (r.requester_user_id=v_req.target_user_id and r.target_user_id=v_req.requester_user_id)
    );

  return query select v_request_id,v_request_status,v_thread_id;
end;
$function$;
