create table public.class_workshop_attendance (
  entry_id uuid not null references public.application_entries(id) on delete cascade,
  session_at timestamptz not null,
  status text not null check (status in ('present', 'absent')),
  primary key (entry_id, session_at)
);

alter table public.class_workshop_attendance enable row level security;
revoke all on public.class_workshop_attendance from public, anon, authenticated;
grant select, insert, update, delete on public.class_workshop_attendance to service_role;
