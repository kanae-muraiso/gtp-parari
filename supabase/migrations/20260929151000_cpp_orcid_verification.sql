-- CPP researcher registration: link an authenticated ORCID account before creating a profile.
begin;

create table public.cpp_orcid_identities (
  user_id uuid not null references auth.users(id) on delete cascade,
  orcid_id text not null
    check (orcid_id ~ '^\d{4}-\d{4}-\d{4}-[\dX]{4}$'),
  environment text not null check (environment in ('sandbox', 'production')),
  verified_at timestamptz not null default now(),
  primary key (user_id, environment),
  unique (environment, orcid_id)
);
alter table public.cpp_orcid_identities enable row level security;
revoke all on public.cpp_orcid_identities from public, anon, authenticated;

create table public.cpp_orcid_oauth_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  state_hash text not null unique,
  environment text not null check (environment in ('sandbox', 'production')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.cpp_orcid_oauth_states enable row level security;
revoke all on public.cpp_orcid_oauth_states from public, anon, authenticated;
create index cpp_orcid_oauth_states_user_expiry_idx
  on public.cpp_orcid_oauth_states(user_id, expires_at);

create schema if not exists private;
create or replace function private.cpp_restrict_orcid_identity_change()
returns trigger language plpgsql
set search_path = ''
as $function$
begin
  if new.user_id is distinct from old.user_id or new.environment is distinct from old.environment or new.orcid_id is distinct from old.orcid_id then
    raise exception 'cpp_orcid_identity_cannot_be_reassigned' using errcode = 'P0001';
  end if;
  return new;
end;
$function$;
revoke all on function private.cpp_restrict_orcid_identity_change() from public, anon, authenticated;
create trigger cpp_orcid_identity_immutable
before update on public.cpp_orcid_identities
for each row execute function private.cpp_restrict_orcid_identity_change();

alter table public.cpp_profiles
  add column orcid_id text,
  add column orcid_verified_at timestamptz;
create unique index cpp_profiles_orcid_id_unique
  on public.cpp_profiles(orcid_id) where orcid_id is not null;

create or replace function private.cpp_set_verified_orcid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_identity public.cpp_orcid_identities%rowtype;
begin
  select * into v_identity
  from public.cpp_orcid_identities
  where user_id = new.user_id and environment = 'production';

  if v_identity.user_id is null then
    if tg_op = 'INSERT' then
      raise exception 'cpp_orcid_verification_required' using errcode = 'P0001';
    end if;
    if old.visibility is distinct from 'published' and new.visibility = 'published' then
      raise exception 'cpp_orcid_verification_required' using errcode = 'P0001';
    end if;
    new.orcid_id := null;
    new.orcid_verified_at := null;
  else
    new.orcid_id := v_identity.orcid_id;
    new.orcid_verified_at := v_identity.verified_at;
  end if;
  return new;
end;
$function$;
revoke all on function private.cpp_set_verified_orcid() from public, anon, authenticated;

drop trigger if exists cpp_profiles_verified_orcid on public.cpp_profiles;
create trigger cpp_profiles_verified_orcid
before insert or update on public.cpp_profiles
for each row execute function private.cpp_set_verified_orcid();

-- Existing profiles remain usable. A callback will populate their verified fields
-- after the owner completes ORCID authentication.
commit;
