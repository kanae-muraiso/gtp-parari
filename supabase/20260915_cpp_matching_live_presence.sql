create or replace function public.cpp_matching_live_profiles(p_target_user_ids uuid[])
returns table(
  user_id uuid,
  display_name text,
  photo_url text,
  affiliation text,
  role_title text,
  topics text[],
  intro text,
  organization_key text,
  joined_at timestamptz,
  can_view_deep boolean,
  deep_kind text,
  deep_target_id uuid
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with viewer as (
    select mm.membership_id, mm.organization_id, mm.view_organization_id
    from public.membership_members mm
    join public.memberships m
      on m.id = mm.membership_id
     and m.name = 'CPP'
     and m.membership_mode = 'matching'
    where mm.user_id = auth.uid()
      and mm.status = 'active'
    order by mm.created_at desc
    limit 1
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
    (target.organization_id = v.view_organization_id) as can_view_deep,
    case
      when target.organization_id <> v.view_organization_id then null
      when org.organization_key = 'CPP-R' then 'researcher'
      when org.organization_key = 'CPP-C' then 'company'
      else null
    end as deep_kind,
    case
      when target.organization_id <> v.view_organization_id then null
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
  join public.membership_organizations org on org.id = target.organization_id
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
$$;

grant execute on function public.cpp_matching_live_profiles(uuid[]) to authenticated;

drop policy if exists "cpp live presence read" on realtime.messages;
create policy "cpp live presence read"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'presence'
  and (select realtime.topic()) like 'cpp-live:%'
  and exists (
    select 1
    from public.membership_members mm
    join public.memberships m on m.id = mm.membership_id
    where mm.user_id = (select auth.uid())
      and mm.status = 'active'
      and m.id = mm.membership_id
      and m.name = 'CPP'
      and m.membership_mode = 'matching'
      and mm.membership_id::text = substring((select realtime.topic()) from 10)
  )
);

drop policy if exists "cpp live presence write" on realtime.messages;
create policy "cpp live presence write"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'presence'
  and (select realtime.topic()) like 'cpp-live:%'
  and exists (
    select 1
    from public.membership_members mm
    join public.memberships m on m.id = mm.membership_id
    where mm.user_id = (select auth.uid())
      and mm.status = 'active'
      and m.id = mm.membership_id
      and m.name = 'CPP'
      and m.membership_mode = 'matching'
      and mm.membership_id::text = substring((select realtime.topic()) from 10)
  )
);