alter table public.applications
  add column if not exists archived_at timestamptz;

comment on column public.applications.archived_at is
  'When set, this APPLICATION is archived: hidden from active selection, excluded from plan active-count limits, and retained for historical entry access.';
