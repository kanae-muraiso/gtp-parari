create table public.school_notices (
  id uuid primary key,
  school_id uuid not null references public.class_schools(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index school_notices_recent_idx on public.school_notices (school_id, created_at desc);

create table public.school_attendance (
  school_id uuid not null,
  enrollment_id uuid not null,
  class_id uuid not null,
  lesson_date date not null,
  absence_reported boolean not null default false,
  actual text check (actual in ('present', 'absent')),
  primary key (school_id, class_id, lesson_date, enrollment_id),
  foreign key (school_id, enrollment_id) references public.school_enrollments(school_id, id) on delete cascade,
  foreign key (school_id, class_id) references public.school_classes(school_id, id) on delete cascade
);
create index school_attendance_enrollment_idx on public.school_attendance (school_id, enrollment_id);

create table public.school_charges (
  id uuid primary key,
  school_id uuid not null,
  enrollment_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  amount_yen integer not null check (amount_yen between 1 and 10000000),
  due_on date not null,
  received_at timestamptz,
  received_by text check (received_by in ('cash', 'transfer', 'other')),
  foreign key (school_id, enrollment_id) references public.school_enrollments(school_id, id) on delete cascade
);
create index school_charges_enrollment_idx on public.school_charges (school_id, enrollment_id, due_on);

alter table public.school_notices enable row level security;
alter table public.school_attendance enable row level security;
alter table public.school_charges enable row level security;
revoke all on public.school_notices, public.school_attendance, public.school_charges from public, anon, authenticated;
grant select, insert, update, delete on public.school_notices, public.school_attendance, public.school_charges to service_role;
