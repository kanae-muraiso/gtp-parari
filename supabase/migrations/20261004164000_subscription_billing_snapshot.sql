-- 2026-10-05 JST
-- Snapshot recurring billing amount/currency per Square subscription.

begin;

alter table public.commerce_subscriptions
  add column if not exists billing_amount numeric,
  add column if not exists billing_currency text;

update public.commerce_subscriptions s
set
  billing_amount = p.amount,
  billing_currency = p.currency
from public.commerce_products p
where p.id = s.product_id
  and (
    s.billing_amount is null
    or s.billing_currency is null
  );

alter table public.commerce_subscriptions
  alter column billing_amount set not null,
  alter column billing_currency set not null;

alter table public.commerce_subscriptions
  add constraint commerce_subscriptions_billing_amount_check
  check (billing_amount > 0);

commit;
