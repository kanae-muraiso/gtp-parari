alter table public.application_entries
  add column if not exists answers jsonb not null default '{}'::jsonb;;
