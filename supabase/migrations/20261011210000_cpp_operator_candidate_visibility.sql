CREATE OR REPLACE FUNCTION cpp_private.is_operator_account(p_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$ SELECT EXISTS(SELECT 1 FROM cpp_private.mode_users WHERE user_id=p_user_id); $function$;
REVOKE ALL ON FUNCTION cpp_private.is_operator_account(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.cpp_matching_visible_members()
 RETURNS TABLE(user_id uuid, display_name text, photo_url text, affiliation text, role_title text, topics text[], intro text, joined_at timestamp with time zone, organization_key text, social_profile_complete boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with viewer as (
    select membership_id,view_organization_id from public.cpp_matching_context()
  )
  select
    target.user_id,
    coalesce(nullif(sp.display_name, ''), nullif(p.display_name, ''), nullif(p.username, ''), 'PARARI USER') as display_name,
    coalesce(sp.photo_url, p.avatar_url) as photo_url,
    sp.affiliation,
    sp.role_title,
    coalesce(sp.topics, '{}'::text[]) as topics,
    sp.intro,
    target.created_at as joined_at,
    org.organization_key,
    (sp.user_id is not null and nullif(sp.display_name, '') is not null) as social_profile_complete
  from viewer v
  join public.membership_members target
    on target.membership_id = v.membership_id
   and target.organization_id = v.view_organization_id
   and target.status = 'active'
  join public.membership_organizations org on org.id = target.organization_id
  left join public.parari_social_profiles sp on sp.user_id = target.user_id
  left join public.profiles p on p.user_id = target.user_id
  where auth.uid() is not null and target.user_id <> auth.uid() and not cpp_private.is_operator_account(target.user_id)
    and (org.organization_key <> 'CPP-R' or (
      exists (select 1 from public.cpp_profiles rp
              where rp.user_id=target.user_id and rp.visibility='published')
      and cpp_security.can_read_researcher(target.user_id)
    ));
$function$
;

CREATE OR REPLACE FUNCTION public.cpp_matching_member_social_profile(p_target_user_id uuid)
 RETURNS TABLE(user_id uuid, display_name text, photo_url text, affiliation text, role_title text, topics text[], intro text, organization_key text, joined_at timestamp with time zone, can_view_deep boolean, deep_kind text, deep_target_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with viewer as (
    select membership_id,organization_id,view_organization_id from public.cpp_matching_context()
  ), target as (
    select mm.*
    from viewer v
    join public.membership_members mm on mm.membership_id = v.membership_id
    where mm.user_id = p_target_user_id
      and mm.status = 'active'
      and mm.organization_id is not null
      and (mm.organization_id = v.organization_id or mm.organization_id = v.view_organization_id)
    limit 1
  ), target_company as (
    select cm.company_id
    from public.cpp_company_members cm
    where cm.user_id = p_target_user_id
      and cm.role in ('owner','editor')
    order by cm.created_at
    limit 1
  )
  select
    t.user_id,
    coalesce(nullif(sp.display_name, ''), nullif(p.display_name, ''), nullif(p.username, ''), 'PARARI USER') as display_name,
    coalesce(sp.photo_url, p.avatar_url) as photo_url,
    sp.affiliation,
    sp.role_title,
    coalesce(sp.topics, '{}'::text[]) as topics,
    sp.intro,
    org.organization_key,
    t.created_at,
    (t.organization_id = v.view_organization_id) as can_view_deep,
    case
      when t.organization_id <> v.view_organization_id then null
      when org.organization_key = 'CPP-R' then 'researcher'
      when org.organization_key = 'CPP-C' then 'company'
      else null
    end as deep_kind,
    case
      when t.organization_id <> v.view_organization_id then null
      when org.organization_key = 'CPP-R' then t.user_id
      when org.organization_key = 'CPP-C' then tc.company_id
      else null
    end as deep_target_id
  from target t
  join viewer v on true
  join public.membership_organizations org on org.id = t.organization_id
  left join public.parari_social_profiles sp on sp.user_id = t.user_id
  left join public.profiles p on p.user_id = t.user_id
  left join target_company tc on true
  where auth.uid() is not null and not cpp_private.is_operator_account(t.user_id) and (org.organization_key <> 'CPP-R' or (
    exists (select 1 from public.cpp_profiles rp
            where rp.user_id=t.user_id and rp.visibility='published')
    and cpp_security.can_read_researcher(t.user_id)
  ));
$function$
;

CREATE OR REPLACE FUNCTION public.cpp_matching_live_profiles(p_target_user_ids uuid[])
 RETURNS TABLE(user_id uuid, display_name text, photo_url text, affiliation text, role_title text, topics text[], intro text, organization_key text, joined_at timestamp with time zone, can_view_deep boolean, deep_kind text, deep_target_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with viewer as (
 select membership_id,organization_id,view_organization_id from public.cpp_matching_context()
  )
  select
    target.user_id,
    coalesce(nullif(sp.display_name, ''), nullif(p.display_name, ''), nullif(p.username, ''), 'PARARI USER') as display_name,
    coalesce(sp.photo_url, p.avatar_url) as photo_url,
    sp.affiliation,
    sp.role_title,
    coalesce(sp.topics, '{}'::text[]) as topics,
    sp.intro,
    org.organization_key,
    target.created_at as joined_at,
    (org.id = v.view_organization_id) as can_view_deep,
    case
      when org.id <> v.view_organization_id then null
      when org.organization_key = 'CPP-R' then 'researcher'
      when org.organization_key = 'CPP-C' then 'company'
      else null
    end as deep_kind,
    case
      when org.id <> v.view_organization_id then null
      when org.organization_key = 'CPP-R' then target.user_id
      when org.organization_key = 'CPP-C' then tc.company_id
      else null
    end as deep_target_id
  from viewer v
  join public.membership_members target
    on target.membership_id = v.membership_id
   and target.status = 'active'
   and target.organization_id is not null
   and target.user_id = any(coalesce(p_target_user_ids, '{}'::uuid[]))
   and not cpp_private.is_operator_account(target.user_id)
   and target.organization_id in (v.organization_id, v.view_organization_id)
  left join cpp_private.mode_users mode_user on mode_user.user_id=target.user_id
  join public.membership_organizations org on org.membership_id=target.membership_id and org.organization_key=case mode_user.mode when 'researcher' then 'CPP-R' when 'company' then 'CPP-C' else (select organization_key from public.membership_organizations where id=target.organization_id) end
  left join public.parari_social_profiles sp on sp.user_id = target.user_id
  left join public.profiles p on p.user_id = target.user_id
  left join lateral (
    select cm.company_id
    from public.cpp_company_members cm
    where cm.user_id = target.user_id
      and cm.role in ('owner','editor')
    order by cm.created_at
    limit 1
  ) tc on true;
$function$
;

CREATE OR REPLACE FUNCTION public.cpp_live_roster(p_target_user_ids uuid[])
 RETURNS TABLE(user_id uuid, display_name text, photo_url text, affiliation text, role_title text, organization_key text, live_status text, open_talk boolean, waiting_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with viewer as (
    select mm.membership_id,mm.organization_id,mm.view_organization_id
    from public.membership_members mm
    join public.memberships m on m.id=mm.membership_id
    where mm.user_id=auth.uid()
      and mm.status='active'
      and m.name='CPP'
      and m.membership_mode='matching'
    order by mm.created_at desc
    limit 1
  )
  select t.user_id,
    coalesce(nullif(sp.display_name,''),nullif(p.display_name,''),nullif(p.username,''),'PARARI USER'),
    coalesce(sp.photo_url,p.avatar_url),
    sp.affiliation,
    sp.role_title,
    org.organization_key,
    case
      when public.cpp_live_is_user_busy(v.membership_id,t.user_id) then 'chatting'
      when coalesce(pref.availability,'available')='away' then 'away'
      else 'available'
    end,
    coalesce(pref.open_talk,false),
    (
      select count(*)::int
      from public.live_open_talk_queue q
      where q.membership_id=v.membership_id
        and q.host_user_id=t.user_id
        and q.status='waiting'
    )
  from viewer v
  join public.membership_members t
    on t.membership_id=v.membership_id
   and t.status='active'
   and not cpp_private.is_operator_account(t.user_id)
   and (t.user_id=auth.uid() or t.user_id=any(coalesce(p_target_user_ids,'{}'::uuid[])))
  join public.membership_organizations org on org.id=t.organization_id
  left join public.live_member_preferences pref on pref.membership_id=v.membership_id and pref.user_id=t.user_id
  left join public.parari_social_profiles sp on sp.user_id=t.user_id
  left join public.profiles p on p.user_id=t.user_id;
$function$
;

CREATE OR REPLACE FUNCTION public.cpp_live_queue_snapshot()
 RETURNS TABLE(queue_id uuid, host_user_id uuid, requester_user_id uuid, queue_status text, queue_position integer, display_name text, host_display_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with mine as (
    select public.cpp_live_my_membership_id() membership_id
  ), q as (
    select
      x.*,
      row_number() over(partition by x.host_user_id,x.status order by x.created_at,x.id)::int pos
    from public.live_open_talk_queue x,mine m
    where x.membership_id=m.membership_id
      and x.status in ('waiting','waitlist')
      and not cpp_private.is_operator_account(x.host_user_id)
      and not cpp_private.is_operator_account(x.requester_user_id)
  )
  select
    q.id,
    q.host_user_id,
    q.requester_user_id,
    q.status,
    q.pos,
    coalesce(nullif(sp.display_name,''),nullif(p.display_name,''),nullif(p.username,''),'PARARI USER'),
    coalesce(nullif(hsp.display_name,''),nullif(hp.display_name,''),nullif(hp.username,''),'PARARI USER')
  from q
  left join public.parari_social_profiles sp on sp.user_id=q.requester_user_id
  left join public.profiles p on p.user_id=q.requester_user_id
  left join public.parari_social_profiles hsp on hsp.user_id=q.host_user_id
  left join public.profiles hp on hp.user_id=q.host_user_id
  order by q.host_user_id,q.status,q.pos;
$function$
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

CREATE OR REPLACE FUNCTION public.cpp_live_open_direct_conversation(p_thread_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_membership_id uuid; v_owner uuid; v_a uuid; v_b uuid; v_room uuid;
begin
  select c.context_id,c.live_owner_user_id,mt.user_a_id,mt.user_b_id into v_membership_id,v_owner,v_a,v_b
  from public.message_thread_contexts c join public.message_threads mt on mt.id=c.thread_id
  where c.thread_id=p_thread_id and c.context_type='membership' and c.relationship_type='matching_live_direct' and c.status='active' limit 1 for update of c;
  if v_membership_id is null then raise exception 'Conversation not found'; end if;
  if cpp_private.is_operator_account(v_a) or cpp_private.is_operator_account(v_b) then raise exception 'Operator is not a matching participant' using errcode='42501'; end if; if v_owner is distinct from auth.uid() then raise exception 'Only the person who was approached can open this conversation'; end if;
  insert into public.live_rooms(membership_id,created_by,room_type,status,access_mode,source_thread_id) values(v_membership_id,auth.uid(),'group','active','open',p_thread_id) returning id into v_room;
  insert into public.live_room_members(room_id,user_id,role,status,responded_at) values(v_room,v_owner,'host','active',now()),(v_room,case when v_a=v_owner then v_b else v_a end,'member','active',now());
  update public.message_thread_contexts set status='ended',ended_at=now(),live_mode='open' where thread_id=p_thread_id and context_type='membership' and context_id=v_membership_id;
  return v_room;
end; $function$
;