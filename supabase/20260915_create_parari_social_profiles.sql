create table if not exists public.parari_social_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  photo_url text,
  affiliation text,
  role_title text,
  topics text[] not null default '{}'::text[],
  intro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.parari_social_profiles enable row level security;

create policy parari_social_profiles_select_authenticated
on public.parari_social_profiles
for select
to authenticated
using (true);

create policy parari_social_profiles_insert_own
on public.parari_social_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

create policy parari_social_profiles_update_own
on public.parari_social_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.set_parari_social_profile_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_parari_social_profile_updated_at on public.parari_social_profiles;
create trigger set_parari_social_profile_updated_at
before update on public.parari_social_profiles
for each row execute function public.set_parari_social_profile_updated_at();

grant select, insert, update on public.parari_social_profiles to authenticated;
