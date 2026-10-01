-- Repair Storage preflight quota checks and keep unpublished researchers out
-- of BROWSE, including direct member URLs and operator company mode.
begin;

create or replace function private.parari_can_upload_image(
  p_name text,
  p_metadata jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_is_monitor boolean := false;
  v_plan text := 'free';
  v_billing_status text := 'none';
  v_new_size bigint := 0;
  v_used_size bigint := 0;
  v_limit bigint := 104857600; -- FREE: 100 MiB
begin
  if v_user_id is null then
    return false;
  end if;

  if p_name is null or p_name not like v_user_id::text || '/%' then
    return false;
  end if;

  -- Storage's upload preflight supplies contentLength, not the persisted size.
  -- Only server-provided object metadata is used; never trust user_metadata.
  v_new_size := coalesce(
    (p_metadata ->> 'size')::bigint,
    (p_metadata ->> 'contentLength')::bigint,
    0
  );

  -- Missing, invalid, or empty size metadata must never bypass the quota.
  if v_new_size <= 0 then
    return false;
  end if;

  select coalesce(p.is_monitor, false)
  into v_is_monitor
  from public.profiles p
  where p.user_id = v_user_id;

  -- Monitors need unrestricted storage while testing every plan feature.
  if v_is_monitor then
    return true;
  end if;

  select
    coalesce(ub.plan, 'free'),
    coalesce(ub.billing_status, 'none')
  into
    v_plan,
    v_billing_status
  from public.user_billing ub
  where ub.user_id = v_user_id;

  -- Inactive paid subscriptions fall back to the FREE quota.
  if v_billing_status in ('active', 'trialing') then
    v_limit := case v_plan
      when 'plus' then 1073741824       -- 1 GiB
      when 'organizer' then 5368709120  -- 5 GiB
      when 'host' then 21474836480      -- 20 GiB
      when 'pro' then 53687091200       -- 50 GiB
      else v_limit
    end;
  end if;

  -- Serialize this quota calculation for the same user. Storage preflight
  -- and final object persistence occur in separate transactions.
  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text, 0)
  );

  select coalesce(
    sum(
      coalesce(
        nullif(o.metadata ->> 'size', '')::bigint,
        0
      )
    ),
    0
  )
  into v_used_size
  from storage.objects o
  where o.bucket_id = 'parari-images'
    and o.name like v_user_id::text || '/%'
    -- On overwrite, replace the existing object's size instead of adding twice.
    and o.name <> p_name;

  return v_used_size + v_new_size <= v_limit;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return false;
end;
$function$;


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
  where auth.uid() is not null and target.user_id <> auth.uid()
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
  where auth.uid() is not null and (org.organization_key <> 'CPP-R' or (
    exists (select 1 from public.cpp_profiles rp
            where rp.user_id=t.user_id and rp.visibility='published')
    and cpp_security.can_read_researcher(t.user_id)
  ));
$function$;


revoke all on function public.cpp_matching_visible_members(),
  public.cpp_matching_member_social_profile(uuid) from public,anon;
grant execute on function public.cpp_matching_visible_members(),
  public.cpp_matching_member_social_profile(uuid) to authenticated;

commit;
