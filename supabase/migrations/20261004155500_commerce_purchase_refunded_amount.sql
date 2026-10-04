-- 2026-10-05 JST
-- Track cumulative completed refunds for commerce purchases.

begin;

alter table public.commerce_purchases
  add column if not exists refunded_amount numeric not null default 0
  check (refunded_amount >= 0);

commit;
