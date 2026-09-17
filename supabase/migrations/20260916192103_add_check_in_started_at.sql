alter table public.applications
  add column if not exists check_in_started_at timestamptz;

alter table public.calendar_occurrences
  add column if not exists check_in_started_at timestamptz;

comment on column public.applications.check_in_started_at is
  'When organizer starts admission check-in for a manual APPLICATION. Once set, participant application/cancellation closes for that APPLICATION.';

comment on column public.calendar_occurrences.check_in_started_at is
  'When organizer starts admission check-in for this occurrence. Once set, participant application/cancellation closes for this occurrence.';
