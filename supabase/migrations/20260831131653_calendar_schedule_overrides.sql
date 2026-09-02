alter table public.calendar_schedules
  add column location text,
  add column duration_minutes integer;

alter table public.calendar_schedules
  add constraint calendar_schedules_duration_minutes_check
    check (
      duration_minutes is null
      or duration_minutes > 0
    );

comment on column public.calendar_schedules.location is
  'Optional location override for this schedule pattern. NULL inherits calendar_items.location.';

comment on column public.calendar_schedules.duration_minutes is
  'Optional duration override for this schedule pattern. NULL inherits calendar_items.duration_minutes.';
