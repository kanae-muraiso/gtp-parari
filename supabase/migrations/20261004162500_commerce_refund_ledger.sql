-- 2026-10-05 JST
-- Idempotent Square commerce refund ledger.

begin;

create table if not exists public.commerce_refunds (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null
    references public.commerce_purchases(id)
    on delete cascade,
  owner_user_id uuid not null
    references auth.users(id)
    on delete cascade,
  buyer_user_id uuid not null
    references auth.users(id)
    on delete cascade,
  provider_refund_id text not null unique,
  amount numeric not null check (amount > 0),
  currency text not null,
  status text not null default 'completed'
    check (status in ('completed','failed')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists commerce_refunds_purchase_idx
  on public.commerce_refunds(
    purchase_id,
    created_at desc
  );

alter table public.commerce_refunds
  enable row level security;

drop policy if exists "buyer_select_own_commerce_refunds"
  on public.commerce_refunds;
create policy "buyer_select_own_commerce_refunds"
  on public.commerce_refunds
  for select
  to authenticated
  using ((select auth.uid()) = buyer_user_id);

drop policy if exists "owner_select_commerce_refunds"
  on public.commerce_refunds;
create policy "owner_select_commerce_refunds"
  on public.commerce_refunds
  for select
  to authenticated
  using ((select auth.uid()) = owner_user_id);

grant select on public.commerce_refunds
  to authenticated;

grant select, insert, update, delete
  on public.commerce_refunds
  to service_role;

commit;
