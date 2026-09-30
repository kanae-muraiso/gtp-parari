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
$function$;
