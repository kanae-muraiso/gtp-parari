-- APPLICATION QR participation pass v1
-- 2026-09-15 JST
--
-- Every APPLICATION entry gets an opaque 16-hex pass code.
-- The pass code contains no participant data and is used only as a lookup key.
-- Check-in remains an organizer-authenticated action.

alter table public.application_entries
  add column if not exists pass_code text;

update public.application_entries
set pass_code = encode(gen_random_bytes(8), 'hex')
where pass_code is null;

alter table public.application_entries
  alter column pass_code
    set default encode(gen_random_bytes(8), 'hex'),
  alter column pass_code
    set not null;

alter table public.application_entries
  drop constraint if exists application_entries_pass_code_format_check;

alter table public.application_entries
  add constraint application_entries_pass_code_format_check
  check (pass_code ~ '^[0-9a-f]{16}$');

create unique index if not exists application_entries_pass_code_unique_idx
  on public.application_entries (pass_code);

alter table public.application_entries
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by uuid;

create index if not exists application_entries_checked_in_at_idx
  on public.application_entries (checked_in_at)
  where checked_in_at is not null;
