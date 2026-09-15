create table if not exists public.cpp_matching_test_assignments (
  user_id uuid primary key references auth.users(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  side text not null check (side in ('CPP-R','CPP-C')),
  assigned_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cpp_matching_test_assignments enable row level security;

create or replace function public.cpp_admin_list_matching_test_users(p_query text default null)
returns table(
  user_id uuid,
  email text,
  display_name text,
  username text,
  avatar_url text,
  membership_side text,
  membership_status text,
  is_test boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.cpp_is_staff(auth.uid()) then
    raise exception 'CPP staff only' using errcode = '42501';
  end if;

  return query
  with cpp as (
    select m.id
    from public.memberships m
    where m.name = 'CPP' and m.membership_mode = 'matching'
    order by m.created_at desc
    limit 1
  )
  select
    u.id,
    u.email::text,
    coalesce(nullif(p.display_name, ''), nullif(p.username, ''), split_part(coalesce(u.email, ''), '@', 1), 'PARARI USER')::text,
    p.username::text,
    p.avatar_url::text,
    org.organization_key::text,
    mm.status::text,
    (ta.user_id is not null) as is_test
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  cross join cpp c
  left join public.membership_members mm on mm.membership_id = c.id and mm.user_id = u.id
  left join public.membership_organizations org on org.id = mm.organization_id
  left join public.cpp_matching_test_assignments ta on ta.user_id = u.id and ta.membership_id = c.id
  where
    nullif(trim(coalesce(p_query, '')), '') is null
    or coalesce(u.email, '') ilike '%' || trim(p_query) || '%'
    or coalesce(p.display_name, '') ilike '%' || trim(p_query) || '%'
    or coalesce(p.username, '') ilike '%' || trim(p_query) || '%'
  order by
    case when ta.user_id is not null then 0 else 1 end,
    lower(coalesce(nullif(p.display_name, ''), nullif(p.username, ''), u.email, u.id::text))
  limit 100;
end;
$$;

create or replace function public.cpp_admin_set_matching_test_membership(
  p_target_user_id uuid,
  p_side text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_membership_id uuid;
  v_own_org_id uuid;
  v_view_org_id uuid;
  v_existing_status text;
  v_has_test boolean;
  v_side text;
begin
  if not public.cpp_is_staff(auth.uid()) then
    raise exception 'CPP staff only' using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users where id = p_target_user_id) then
    raise exception 'PARARI user not found';
  end if;

  select m.id into v_membership_id
  from public.memberships m
  where m.name = 'CPP' and m.membership_mode = 'matching'
  order by m.created_at desc
  limit 1;

  if v_membership_id is null then
    raise exception 'CPP matching membership not found';
  end if;

  select mm.status
    into v_existing_status
  from public.membership_members mm
  where mm.membership_id = v_membership_id
    and mm.user_id = p_target_user_id;

  select exists(
    select 1 from public.cpp_matching_test_assignments ta
    where ta.membership_id = v_membership_id
      and ta.user_id = p_target_user_id
  ) into v_has_test;

  v_side := upper(trim(coalesce(p_side, '')));

  if v_side in ('', 'NONE', 'REMOVE') then
    if not v_has_test then
      raise exception 'This user does not have a test membership';
    end if;

    delete from public.membership_members
    where membership_id = v_membership_id
      and user_id = p_target_user_id;

    delete from public.cpp_matching_test_assignments
    where membership_id = v_membership_id
      and user_id = p_target_user_id;

    return;
  end if;

  if v_side not in ('CPP-R', 'CPP-C') then
    raise exception 'p_side must be CPP-R, CPP-C, or NONE';
  end if;

  if v_existing_status = 'active' and not v_has_test then
    raise exception 'This user already has a non-test CPP membership';
  end if;

  select o.id into v_own_org_id
  from public.membership_organizations o
  where o.membership_id = v_membership_id
    and o.organization_key = v_side
  limit 1;

  select o.id into v_view_org_id
  from public.membership_organizations o
  where o.membership_id = v_membership_id
    and o.organization_key = case when v_side = 'CPP-R' then 'CPP-C' else 'CPP-R' end
  limit 1;

  if v_own_org_id is null or v_view_org_id is null then
    raise exception 'CPP-R / CPP-C organizations are not configured';
  end if;

  insert into public.membership_members (
    membership_id,
    user_id,
    status,
    organization_id,
    view_organization_id,
    updated_at
  ) values (
    v_membership_id,
    p_target_user_id,
    'active',
    v_own_org_id,
    v_view_org_id,
    now()
  )
  on conflict (membership_id, user_id) do update
  set status = 'active',
      organization_id = excluded.organization_id,
      view_organization_id = excluded.view_organization_id,
      updated_at = now();

  insert into public.cpp_matching_test_assignments (
    user_id,
    membership_id,
    side,
    assigned_by,
    updated_at
  ) values (
    p_target_user_id,
    v_membership_id,
    v_side,
    auth.uid(),
    now()
  )
  on conflict (user_id) do update
  set membership_id = excluded.membership_id,
      side = excluded.side,
      assigned_by = excluded.assigned_by,
      updated_at = now();
end;
$$;

revoke all on function public.cpp_admin_list_matching_test_users(text) from public;
revoke all on function public.cpp_admin_set_matching_test_membership(uuid, text) from public;
grant execute on function public.cpp_admin_list_matching_test_users(text) to authenticated;
grant execute on function public.cpp_admin_set_matching_test_membership(uuid, text) to authenticated;
