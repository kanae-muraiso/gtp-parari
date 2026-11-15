create table public.school_class_product_designs (
  school_id uuid primary key references public.class_schools(id) on delete cascade,
  design jsonb not null check (jsonb_typeof(design) = 'object')
);
alter table public.school_class_product_designs enable row level security;
revoke all on public.school_class_product_designs from public, anon, authenticated;
grant select, insert, update on public.school_class_product_designs to service_role;
