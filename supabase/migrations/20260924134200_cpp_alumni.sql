create table if not exists public.cpp_alumni (
  user_id uuid primary key references auth.users(id) on delete cascade,
  participation_year smallint not null,
  participation_location text not null,
  cpp_memory text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cpp_alumni_participation_year_check
    check (participation_year between 2005 and 2100),
  constraint cpp_alumni_participation_location_check
    check (
      char_length(btrim(participation_location)) between 1 and 120
    ),
  constraint cpp_alumni_cpp_memory_check
    check (
      char_length(btrim(cpp_memory)) between 1 and 150
    )
);

comment on table public.cpp_alumni is
  'CPP alumni registration. Shared identity/profile fields remain in existing PARARI/CPP social profile tables.';
comment on column public.cpp_alumni.participation_year is
  'Year the user participated in CPP.';
comment on column public.cpp_alumni.participation_location is
  'Location/city of the CPP event attended by the user.';
comment on column public.cpp_alumni.cpp_memory is
  'Short memory or impression from the user''s CPP participation, up to 150 characters.';

create index if not exists cpp_alumni_created_at_idx
  on public.cpp_alumni (created_at asc);

alter table public.cpp_alumni enable row level security;

grant select, insert, update
  on public.cpp_alumni
  to authenticated;

create or replace function private.is_cpp_alumni_member(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id is not null
    and exists (
      select 1
      from public.cpp_alumni
      where user_id = p_user_id
    );
$$;

revoke all
  on function private.is_cpp_alumni_member(uuid)
  from public;
grant execute
  on function private.is_cpp_alumni_member(uuid)
  to authenticated;

create policy "cpp_alumni_select_members"
  on public.cpp_alumni
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (
      select private.is_cpp_alumni_member(
        (select auth.uid())
      )
    )
  );

create policy "cpp_alumni_insert_own"
  on public.cpp_alumni
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
  );

create policy "cpp_alumni_update_own"
  on public.cpp_alumni
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
  )
  with check (
    (select auth.uid()) = user_id
  );
