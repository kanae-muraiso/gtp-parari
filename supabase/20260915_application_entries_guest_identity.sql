-- PARARI APPLICATION guest identity
-- 2026-09-15 JST
--
-- Guest applicants are stored in the existing application_entries table.
-- Existing authenticated entries remain unchanged because both columns are nullable.

alter table public.application_entries
  add column if not exists applicant_name text,
  add column if not exists applicant_email text;

alter table public.application_entries
  drop constraint if exists application_entries_applicant_name_length_check,
  add constraint application_entries_applicant_name_length_check
    check (
      applicant_name is null
      or char_length(btrim(applicant_name)) between 1 and 120
    );

alter table public.application_entries
  drop constraint if exists application_entries_applicant_email_length_check,
  add constraint application_entries_applicant_email_length_check
    check (
      applicant_email is null
      or char_length(btrim(applicant_email)) between 3 and 320
    );

-- One active guest entry per ordinary APPLICATION and normalized email address.
-- cancelled / withdrawn remain historical rows and permit a new application.
create unique index if not exists
  application_entries_guest_application_email_unique_idx
on public.application_entries (
  application_id,
  (lower(btrim(applicant_email)))
)
where
  calendar_occurrence_id is null
  and user_id is null
  and applicant_email is not null
  and status in (
    'submitted',
    'confirmed',
    'rejected'
  );

-- One active guest booking per CALENDAR occurrence and normalized email address.
create unique index if not exists
  application_entries_guest_occurrence_email_unique_idx
on public.application_entries (
  calendar_occurrence_id,
  (lower(btrim(applicant_email)))
)
where
  calendar_occurrence_id is not null
  and user_id is null
  and applicant_email is not null
  and status in (
    'submitted',
    'confirmed',
    'rejected'
  );
