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
   and (t.user_id=auth.uid() or not cpp_private.is_operator_account(t.user_id))
   and (t.user_id=auth.uid() or t.user_id=any(coalesce(p_target_user_ids,'{}'::uuid[])))
  join public.membership_organizations org on org.id=t.organization_id
  left join public.live_member_preferences pref on pref.membership_id=v.membership_id and pref.user_id=t.user_id
  left join public.parari_social_profiles sp on sp.user_id=t.user_id
  left join public.profiles p on p.user_id=t.user_id;
$function$
;