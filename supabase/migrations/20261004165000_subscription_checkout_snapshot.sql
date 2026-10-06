-- 2026-10-05 JST
-- Snapshot recurring checkout terms so product edits cannot change an in-flight subscription.

begin;

alter table public.commerce_subscription_checkouts
  add column if not exists billing_amount numeric,
  add column if not exists billing_currency text,
  add column if not exists square_plan_variation_id text;

update public.commerce_subscription_checkouts c
set
  billing_amount = p.amount,
  billing_currency = p.currency,
  square_plan_variation_id = p.square_plan_variation_id
from public.commerce_products p
where p.id = c.product_id
  and (
    c.billing_amount is null
    or c.billing_currency is null
    or c.square_plan_variation_id is null
  );

alter table public.commerce_subscription_checkouts
  alter column billing_amount set not null,
  alter column billing_currency set not null,
  alter column square_plan_variation_id set not null;

alter table public.commerce_subscription_checkouts
  add constraint commerce_subscription_checkouts_billing_amount_check
  check (billing_amount > 0);

commit;
