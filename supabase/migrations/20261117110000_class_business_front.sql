create table public.class_business_fronts (
  school_id uuid primary key references public.class_schools(id) on delete cascade,
  draft jsonb not null check (jsonb_typeof(draft) = 'object'),
  published jsonb check (jsonb_typeof(published) = 'object'),
  revision integer not null check (revision > 0)
);

alter table public.class_business_fronts enable row level security;
revoke all on public.class_business_fronts from public, anon, authenticated;
grant select, insert, update on public.class_business_fronts to service_role;
