-- Isolated CLASS subscription authority and optional event/workshop PAGE association.
-- All writes are server-authorized; neither table is directly accessible from browsers.
create table if not exists public.class_feature_plans (
  school_id uuid primary key references public.class_schools(id) on delete cascade,
  plan text not null default 'a' check (plan in ('a','b')),
  active_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.class_feature_plans enable row level security;
revoke all on public.class_feature_plans from anon, authenticated;
create table if not exists public.class_event_pages (
  event_id uuid primary key references public.applications(id) on delete cascade,
  work_id uuid not null references public.parari_books(id) on delete cascade,
  updated_at timestamptz not null default now()
);
alter table public.class_event_pages enable row level security;
revoke all on public.class_event_pages from anon, authenticated;
create index if not exists class_event_pages_work_idx on public.class_event_pages(work_id);
