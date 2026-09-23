alter table public.application_entries
  add column if not exists applicant_email_verified_at timestamptz;

create table if not exists public.application_guest_verifications (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  applicant_name text not null,
  applicant_email text not null,
  form_submission_id uuid null references public.form_submissions(id) on delete cascade,
  calendar_occurrence_id uuid null references public.calendar_occurrences(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint application_guest_verifications_name_check
    check (char_length(btrim(applicant_name)) between 1 and 120),
  constraint application_guest_verifications_email_check
    check (char_length(btrim(applicant_email)) between 3 and 320),
  constraint application_guest_verifications_answers_object
    check (jsonb_typeof(answers) = 'object'),
  constraint application_guest_verifications_token_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists application_guest_verifications_lookup_idx
  on public.application_guest_verifications
    (application_id, applicant_email, calendar_occurrence_id, created_at desc);

create index if not exists application_guest_verifications_expiry_idx
  on public.application_guest_verifications (expires_at);

alter table public.application_guest_verifications enable row level security;

revoke all on table public.application_guest_verifications
  from anon, authenticated;

comment on column public.application_entries.applicant_email_verified_at is
  'When a guest applicant proved control of applicant_email by following a PARARI verification link.';

comment on table public.application_guest_verifications is
  'Short-lived server-only guest APPLICATION requests awaiting email verification. No application_entry is created until verification succeeds.';
