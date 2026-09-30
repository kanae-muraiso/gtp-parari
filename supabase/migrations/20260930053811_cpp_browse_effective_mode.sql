CREATE OR REPLACE FUNCTION public.cpp_matching_visible_members()
 RETURNS TABLE(user_id uuid, display_name text, photo_url text, affiliation text, role_title text, topics text[], intro text, joined_at timestamp with time zone, organization_key text, social_profile_complete boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$;
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
  where target.user_id <> auth.uid();
$function$
;
