-- CLASS B production billing migration. Reviewed 2026-11-28.
-- Run after class-b-class-blocks-draft.sql. No client privileges.
begin;
create table public.class_b_contracts (
  school_id uuid primary key references public.class_schools(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  attempt_id uuid not null unique default gen_random_uuid(),
  requested_blocks integer not null check(requested_blocks between 1 and 1000000),
  status text not null default 'pending' check(status in ('pending','active','past_due','canceled','expired')),
  stripe_checkout_session_id text unique,
  stripe_subscription_id text unique,
  stripe_customer_id text,
  paid_blocks integer not null default 0 check(paid_blocks between 0 and 1000000),
  paid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.class_b_contracts enable row level security;
revoke all on public.class_b_contracts from public, anon, authenticated;
grant select,insert,update on public.class_b_contracts to service_role;
-- A school can have only one pending or active contract in this ledger.
-- Do not recycle a pending attempt automatically: verify the original Stripe
-- session is expired and no subscription exists before allowing another.
commit;
