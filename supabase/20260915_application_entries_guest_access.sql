-- PARARI APPLICATION guest self-service access
-- 2026-09-15 JST
--
-- Store only a SHA-256 hash of the guest management token.
-- The raw token is returned once to the guest and can later be delivered by email.

alter table public.application_entries
  add column if not exists guest_access_token_hash text,
  add column if not exists guest_access_token_created_at timestamptz,
  add column if not exists guest_email_verified_at timestamptz;

alter table public.application_entries
  drop constraint if exists application_entries_guest_access_hash_length_check,
  add constraint application_entries_guest_access_hash_length_check
    check (
      guest_access_token_hash is null
      or char_length(guest_access_token_hash) = 64
    );

create unique index if not exists
  application_entries_guest_access_token_hash_unique_idx
on public.application_entries (guest_access_token_hash)
where guest_access_token_hash is not null;
