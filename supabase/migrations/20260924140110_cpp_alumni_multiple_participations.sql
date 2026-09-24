create table if not exists public.cpp_alumni_participations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.cpp_alumni(user_id) on delete cascade,
  participation_year smallint not null,
  participation_location text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cpp_alumni_participations_year_check
    check (participation_year between 2005 and 2100),
  constraint cpp_alumni_participations_location_check
    check (char_length(btrim(participation_location)) between 1 and 120),
  constraint cpp_alumni_participations_sort_order_check
    check (sort_order >= 0),
  constraint cpp_alumni_participations_unique
    unique (user_id, participation_year, participation_location)
);

comment on table public.cpp_alumni_participations is
  'All CPP participation years and locations for one alumni registration.';

create index if not exists cpp_alumni_participations_user_sort_idx
  on public.cpp_alumni_participations (user_id, sort_order, created_at);

insert into public.cpp_alumni_participations (
  user_id,
  participation_year,
  participation_location,
  sort_order
)
select
  user_id,
  participation_year,
  participation_location,
  0
from public.cpp_alumni
where participation_year is not null
  and participation_location is not null
on conflict (user_id, participation_year, participation_location) do nothing;

alter table public.cpp_alumni
  alter column participation_year drop not null,
  alter column participation_location drop not null;

comment on column public.cpp_alumni.participation_year is
  'Legacy mirror of the first CPP participation. Full history is in cpp_alumni_participations.';
comment on column public.cpp_alumni.participation_location is
  'Legacy mirror of the first CPP participation. Full history is in cpp_alumni_participations.';

alter table public.cpp_alumni_participations enable row level security;

grant select, insert, update, delete
  on public.cpp_alumni_participations
  to authenticated;

create policy "cpp_alumni_participations_select_members"
  on public.cpp_alumni_participations
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (
      select private.is_cpp_alumni_member((select auth.uid()))
    )
  );

create policy "cpp_alumni_participations_insert_own"
  on public.cpp_alumni_participations
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "cpp_alumni_participations_update_own"
  on public.cpp_alumni_participations
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "cpp_alumni_participations_delete_own"
  on public.cpp_alumni_participations
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.cpp_alumni_replace_participations(
  p_participations jsonb
)
returns setof public.cpp_alumni_participations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_item jsonb;
  v_year smallint;
  v_location text;
  v_sort_order integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.cpp_alumni
    where user_id = v_user_id
  ) then
    raise exception 'CPP alumni registration required'
      using errcode = '42501';
  end if;

  if p_participations is null
    or jsonb_typeof(p_participations) <> 'array'
    or jsonb_array_length(p_participations) < 1
    or jsonb_array_length(p_participations) > 50 then
    raise exception 'Participation history must contain 1 to 50 entries'
      using errcode = '22023';
  end if;

  delete from public.cpp_alumni_participations
  where user_id = v_user_id;

  for v_item in
    select value
    from jsonb_array_elements(p_participations)
  loop
    begin
      v_year := (v_item ->> 'participation_year')::smallint;
    exception
      when others then
        raise exception 'Invalid participation year'
          using errcode = '22023';
    end;

    v_location := btrim(coalesce(v_item ->> 'participation_location', ''));

    if v_year < 2005 or v_year > 2100 then
      raise exception 'Invalid participation year'
        using errcode = '22023';
    end if;

    if char_length(v_location) < 1 or char_length(v_location) > 120 then
      raise exception 'Invalid participation location'
        using errcode = '22023';
    end if;

    insert into public.cpp_alumni_participations (
      user_id,
      participation_year,
      participation_location,
      sort_order
    )
    values (
      v_user_id,
      v_year,
      v_location,
      v_sort_order
    );

    v_sort_order := v_sort_order + 1;
  end loop;

  return query
  select p.*
  from public.cpp_alumni_participations p
  where p.user_id = v_user_id
  order by p.sort_order, p.created_at;
end;
$$;

revoke all
  on function public.cpp_alumni_replace_participations(jsonb)
  from public, anon;
grant execute
  on function public.cpp_alumni_replace_participations(jsonb)
  to authenticated;
