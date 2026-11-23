-- Additive, isolated owner-only CLASS onboarding draft store.
-- This does not alter existing school, enrollment, billing or work records.
create table if not exists public.class_onboarding_drafts (
  school_id uuid primary key references public.class_schools(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id),
  wizard jsonb not null default '{}'::jsonb check (jsonb_typeof(wizard)='object'),
  sales_answers jsonb not null default '[]'::jsonb check (jsonb_typeof(sales_answers)='array'),
  landing_page_id uuid references public.parari_books(id) on delete set null,
  revision integer not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now()
);
create index if not exists class_onboarding_drafts_owner_idx on public.class_onboarding_drafts(owner_user_id);
alter table public.class_onboarding_drafts enable row level security;
revoke all on public.class_onboarding_drafts from anon, authenticated;
-- The server validates a Supabase bearer session plus school ownership before
-- making service-role queries; no anonymous or client-side Data API permissions.
