CREATE OR REPLACE FUNCTION cpp_private.cpp_live_gate_open(p_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
SELECT p_user_id IS NOT NULL AND EXISTS(
 SELECT 1 FROM public.cpp_live_events e
 WHERE e.status='scheduled' AND now()>=e.starts_at AND now()<e.ends_at
 AND (
 EXISTS(SELECT 1 FROM cpp_private.mode_users u WHERE u.user_id=p_user_id AND u.mode='admin')
 OR ('alumni'=ANY(e.audience) AND EXISTS(SELECT 1 FROM public.cpp_alumni a WHERE a.user_id=p_user_id))
 OR (NOT EXISTS(SELECT 1 FROM public.cpp_alumni a WHERE a.user_id=p_user_id)
     AND EXISTS(SELECT 1 FROM public.cpp_matching_context() ctx
       WHERE ctx.organization_key=CASE WHEN 'researcher'=ANY(e.audience) THEN 'CPP-R' ELSE 'CPP-C' END)
     AND (('researcher'=ANY(e.audience) AND EXISTS(SELECT 1 FROM public.cpp_matching_context() ctx WHERE ctx.organization_key='CPP-R'))
       OR ('company'=ANY(e.audience) AND EXISTS(SELECT 1 FROM public.cpp_matching_context() ctx WHERE ctx.organization_key='CPP-C'))))
 )
);
$$;
REVOKE ALL ON FUNCTION cpp_private.cpp_live_gate_open(uuid) FROM public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.cpp_live_enter(p_minutes integer DEFAULT 60)
 RETURNS TABLE(live_until timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_membership_id uuid; v_minutes integer:=greatest(10,least(coalesce(p_minutes,60),240)); v_until timestamptz;
begin
 IF NOT cpp_private.cpp_live_gate_open(auth.uid()) THEN RAISE EXCEPTION 'LIVEは開催時間外です' USING errcode='42501'; END IF;
  v_membership_id:=public.cpp_live_my_membership_id(); if v_membership_id is null then raise exception 'CPP membership required'; end if;
  v_until:=now()+make_interval(mins=>v_minutes);
  insert into public.live_member_preferences(membership_id,user_id,availability,open_talk,live_entered_at,live_until,last_seen_at,is_live,updated_at)
  values(v_membership_id,auth.uid(),'available',false,now(),v_until,now(),true,now())
  on conflict(membership_id,user_id) do update set availability='available',live_entered_at=now(),live_until=v_until,last_seen_at=now(),is_live=true,open_talk=false,updated_at=now();
  return query select v_until;
end; $function$
;

CREATE OR REPLACE FUNCTION public.cpp_live_enter_as(p_minutes integer DEFAULT 60, p_availability text DEFAULT 'available'::text)
 RETURNS TABLE(live_until timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_membership_id uuid;
  v_minutes integer:=greatest(10,least(coalesce(p_minutes,60),240));
  v_until timestamptz;
begin
 IF NOT cpp_private.cpp_live_gate_open(auth.uid()) THEN RAISE EXCEPTION 'LIVEは開催時間外です' USING errcode='42501'; END IF;
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
$function$
;

CREATE OR REPLACE FUNCTION public.cpp_live_heartbeat()
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_membership_id uuid; v_until timestamptz;
begin
  if not cpp_private.cpp_live_gate_open(auth.uid()) then
    update public.live_member_preferences SET is_live=false WHERE user_id=auth.uid();
    return null;
  end if;
  v_membership_id:=public.cpp_live_my_membership_id(); if v_membership_id is null then raise exception 'CPP membership required'; end if;
  update public.live_member_preferences set last_seen_at=now(),updated_at=now()
  where membership_id=v_membership_id and user_id=auth.uid() and is_live=true returning live_until into v_until;
  return v_until;
end; $function$
;

CREATE OR REPLACE FUNCTION public.cpp_live_operator_presence(p_active boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not exists (
    select 1 from cpp_private.mode_users u
    where u.user_id=auth.uid() and u.mode='admin'
  ) then
    raise exception '管理者モードが必要です' using errcode='42501';
  end if;
  if p_active AND NOT cpp_private.cpp_live_gate_open(auth.uid()) THEN RAISE EXCEPTION 'LIVEは開催時間外です' USING errcode='42501'; END IF;
  if p_active then
    insert into cpp_private.live_operator_presence(user_id,expires_at,last_seen_at)
    values(auth.uid(),now()+interval '60 minutes',now())
    on conflict(user_id) do update
      set expires_at=now()+interval '60 minutes',last_seen_at=now();
  else
    delete from cpp_private.live_operator_presence where user_id=auth.uid();
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.cpp_live_request_conversation(p_target_user_id uuid)
 RETURNS TABLE(request_id uuid, request_status text, thread_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_me uuid := auth.uid();
  v_membership_id uuid;
  v_existing_request public.matching_conversation_requests%rowtype;
  v_thread_id uuid;
  v_request_id uuid;
  v_request_status text;
  v_target_availability text;
begin
 IF NOT cpp_private.cpp_live_gate_open(auth.uid()) THEN RAISE EXCEPTION 'LIVEは開催時間外です' USING errcode='42501'; END IF;
  if v_me is null then raise exception 'Authentication required'; end if;
  if p_target_user_id is null or p_target_user_id = v_me then raise exception 'Invalid target'; end if;
  if cpp_private.is_operator_account(v_me) or cpp_private.is_operator_account(p_target_user_id) then raise exception '運営者は通常のマッチング対象ではありません' using errcode='42501'; end if;

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
    from public.live_member_preferences lp
    where lp.membership_id = v_membership_id
      and lp.user_id = v_me
      and lp.is_live = true
      and lp.live_until > now()
      and lp.last_seen_at > now() - interval '2 minutes'
      and coalesce(lp.availability, 'available') = 'available'
  ) then
    raise exception '離席中です。「話せます」に戻してから話しかけてください。';
  end if;

  if public.cpp_live_is_user_busy(v_membership_id, v_me) then
    raise exception 'Finish your current conversation first';
  end if;

  select coalesce(lp.availability, 'available') into v_target_availability
  from public.membership_members mm
  join public.live_member_preferences lp
    on lp.membership_id = mm.membership_id and lp.user_id = mm.user_id
  where mm.membership_id = v_membership_id
    and mm.user_id = p_target_user_id
    and mm.status = 'active'
    and lp.is_live = true
    and lp.live_until > now()
    and lp.last_seen_at > now() - interval '2 minutes'
  limit 1;

  if v_target_availability is null then
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
    and r.request_kind = 'live'
  order by r.created_at desc
  limit 1;

  if v_existing_request.id is not null then
    return query select v_existing_request.id, v_existing_request.status, v_existing_request.thread_id;
    return;
  end if;

  insert into public.matching_conversation_requests as r
    (membership_id, requester_user_id, target_user_id, request_kind)
  values
    (v_membership_id, v_me, p_target_user_id, 'live')
  returning r.id, r.status, r.thread_id
    into v_request_id, v_request_status, v_thread_id;

  return query select v_request_id, v_request_status, v_thread_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cpp_live_start_direct_internal(p_membership_id uuid, p_user_1 uuid, p_user_2 uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_a uuid;
  v_b uuid;
  v_thread_id uuid;
begin
 IF NOT cpp_private.cpp_live_gate_open(auth.uid()) THEN RAISE EXCEPTION 'LIVEは開催時間外です' USING errcode='42501'; END IF;
  if cpp_private.is_operator_account(p_user_1) or cpp_private.is_operator_account(p_user_2) then raise exception 'Operator is not a matching participant' using errcode='42501'; end if;
  if p_user_1::text < p_user_2::text then v_a:=p_user_1; v_b:=p_user_2; else v_a:=p_user_2; v_b:=p_user_1; end if;
  insert into public.message_threads as mt(user_a_id,user_b_id)
  values(v_a,v_b)
  on conflict(user_a_id,user_b_id) do update set updated_at=now()
  returning mt.id into v_thread_id;

  insert into public.message_thread_contexts(thread_id,context_type,context_id,relationship_type,status,user_a_role,user_b_role)
  values(v_thread_id,'membership',p_membership_id,'matching_live_direct','active','member','member')
  on conflict on constraint message_thread_contexts_unique_source do update
    set relationship_type='matching_live_direct', status='active', ended_at=null;
  return v_thread_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cpp_live_operator_heartbeat()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not exists (
  select 1 from cpp_private.mode_users u
  where u.user_id=auth.uid() and u.mode='admin'
 ) then raise exception '管理者モードが必要です' using errcode='42501'; end if;
 if not cpp_private.cpp_live_gate_open(auth.uid()) then
  delete from cpp_private.live_operator_presence where user_id=auth.uid();
  return;
 end if;
 update cpp_private.live_operator_presence
 set last_seen_at=now()
 where user_id=auth.uid() and expires_at>now();
end $function$
;