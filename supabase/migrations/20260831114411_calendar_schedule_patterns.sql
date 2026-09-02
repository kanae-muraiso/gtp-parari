alter table public.calendar_schedules
  add column name text,
  add column occurrence_horizon_days integer not null default 30,
  add column application_open_days_before integer not null default 30,
  add column application_close_minutes_before integer not null default 180;

alter table public.calendar_schedules
  add constraint calendar_schedules_name_length_check
    check (
      name is null
      or char_length(btrim(name)) between 1 and 120
    ),
  add constraint calendar_schedules_occurrence_horizon_days_check
    check (
      occurrence_horizon_days between 1 and 730
    ),
  add constraint calendar_schedules_application_open_days_before_check
    check (
      application_open_days_before between 0 and 730
    ),
  add constraint calendar_schedules_application_close_minutes_before_check
    check (
      application_close_minutes_before between 0 and 525600
    ),
  add constraint calendar_schedules_horizon_covers_application_open_check
    check (
      occurrence_horizon_days >= application_open_days_before
    ),
  add constraint calendar_schedules_application_window_order_check
    check (
      application_close_minutes_before
      <= application_open_days_before * 1440
    );

comment on column public.calendar_schedules.name is
  'User-facing name for this schedule pattern within a calendar item.';

comment on column public.calendar_schedules.occurrence_horizon_days is
  'Rolling number of days ahead for which occurrences should be materialized.';

comment on column public.calendar_schedules.application_open_days_before is
  'Days before an occurrence when APPLICATION may start accepting entries.';

comment on column public.calendar_schedules.application_close_minutes_before is
  'Minutes before an occurrence when APPLICATION should stop accepting entries.';
