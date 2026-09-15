-- Production migration applied as application_cancellation_policy on 2026-09-15.
-- Kept here as the repository source-of-truth for the live schema.

alter table public.applications
  add column if not exists cancellation_mode text not null default 'not_allowed',
  add column if not exists cancellation_deadline_at timestamptz,
  add column if not exists cancellation_cutoff_minutes integer;

alter table public.applications
  drop constraint if exists applications_cancellation_mode_check,
  add constraint applications_cancellation_mode_check
    check (cancellation_mode in ('not_allowed', 'anytime', 'until_deadline')),
  drop constraint if exists applications_cancellation_cutoff_minutes_check,
  add constraint applications_cancellation_cutoff_minutes_check
    check (cancellation_cutoff_minutes is null or cancellation_cutoff_minutes >= 0);

alter table public.application_entries
  add column if not exists cancellation_token text not null default encode(gen_random_bytes(16), 'hex'),
  add column if not exists cancelled_at timestamptz;

create unique index if not exists application_entries_cancellation_token_key
  on public.application_entries (cancellation_token);

alter table public.application_entries
  drop constraint if exists application_entries_cancellation_token_format_check,
  add constraint application_entries_cancellation_token_format_check
    check (cancellation_token ~ '^[0-9a-f]{32}$');
