-- 2026-10-05 JST
-- PARARI Organizer commerce foundation
-- Purchase / Entitlement / recurring subscription / platform-fee ledger.
-- Work SSOT remains unchanged; access is granted only through RLS.

begin;

create table if not exists public.commerce_products (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  product_type text not null
    check (product_type in ('work','service','recurring')),
  work_id uuid references public.parari_books(id) on delete cascade,
  name text not null,
  description text,
  amount numeric not null check (amount > 0),
  currency text not null default 'JPY',
  billing_interval text not null default 'one_time'
    check (billing_interval in ('one_time','monthly')),
  active boolean not null default true,
  square_plan_id text,
  square_plan_variation_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (product_type = 'work' and work_id is not null and billing_interval = 'one_time')
    or product_type <> 'work'
  ),
  check (
    (billing_interval = 'monthly' and product_type in ('recurring','service'))
    or billing_interval = 'one_time'
  )
);

create unique index if not exists commerce_products_active_work_interval_idx
  on public.commerce_products(work_id, billing_interval)
  where work_id is not null and active = true;

create index if not exists commerce_products_owner_idx
  on public.commerce_products(owner_user_id, created_at desc);

alter table public.commerce_products enable row level security;

create table if not exists public.commerce_purchases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.commerce_products(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  buyer_user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'square' check (provider = 'square'),
  status text not null default 'created'
    check (status in ('created','pending','paid','failed','cancelled','refunded')),
  amount numeric not null check (amount > 0),
  currency text not null,
  merchant_id text not null,
  location_id text not null,
  provider_order_id text unique,
  provider_payment_link_id text unique,
  provider_payment_id text unique,
  checkout_url text,
  idempotency_key text not null unique,
  app_fee_amount numeric not null default 0 check (app_fee_amount >= 0),
  completed_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commerce_purchases_buyer_idx
  on public.commerce_purchases(buyer_user_id, created_at desc);

create index if not exists commerce_purchases_owner_idx
  on public.commerce_purchases(owner_user_id, created_at desc);

alter table public.commerce_purchases enable row level security;

create table if not exists public.commerce_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.commerce_products(id) on delete cascade,
  work_id uuid references public.parari_books(id) on delete cascade,
  source_purchase_id uuid references public.commerce_purchases(id) on delete set null,
  source_subscription_id text,
  status text not null default 'active'
    check (status in ('active','revoked','expired')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  remaining_uses integer check (remaining_uses is null or remaining_uses >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists commerce_entitlements_work_user_idx
  on public.commerce_entitlements(work_id, user_id)
  where work_id is not null;

alter table public.commerce_entitlements enable row level security;

create table if not exists public.commerce_subscription_checkouts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.commerce_products(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  buyer_user_id uuid not null references auth.users(id) on delete cascade,
  buyer_email text,
  provider_order_id text not null unique,
  provider_payment_link_id text not null unique,
  checkout_url text,
  status text not null default 'pending'
    check (status in ('pending','active','expired','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commerce_subscription_checkouts_buyer_idx
  on public.commerce_subscription_checkouts(buyer_user_id, created_at desc);

create index if not exists commerce_subscription_checkouts_product_email_idx
  on public.commerce_subscription_checkouts(
    product_id,
    lower(buyer_email),
    created_at desc
  )
  where buyer_email is not null;

create unique index if not exists commerce_products_square_plan_variation_uidx
  on public.commerce_products(square_plan_variation_id)
  where square_plan_variation_id is not null;

alter table public.commerce_subscription_checkouts enable row level security;

create table if not exists public.commerce_subscriptions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.commerce_products(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  buyer_user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'square' check (provider = 'square'),
  provider_customer_id text,
  provider_subscription_id text not null unique,
  status text not null default 'PENDING',
  app_fee_bps integer not null default 500
    check (app_fee_bps >= 0 and app_fee_bps <= 10000),
  started_at timestamptz not null default now(),
  canceled_at timestamptz,
  last_payment_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commerce_subscriptions_owner_idx
  on public.commerce_subscriptions(owner_user_id, created_at desc);

create index if not exists commerce_subscriptions_buyer_idx
  on public.commerce_subscriptions(buyer_user_id, created_at desc);

alter table public.commerce_subscriptions enable row level security;

create table if not exists public.commerce_platform_fee_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.commerce_subscriptions(id) on delete set null,
  provider_charge_id text not null unique,
  gross_amount numeric not null check (gross_amount > 0),
  fee_amount numeric not null check (fee_amount >= 0),
  currency text not null,
  paid_at timestamptz not null,
  billing_month date not null,
  status text not null default 'open'
    check (status in ('open','invoiced','paid','waived')),
  stripe_invoice_id text,
  stripe_invoice_item_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commerce_platform_fee_ledger_owner_month_idx
  on public.commerce_platform_fee_ledger(owner_user_id, billing_month, status);

alter table public.commerce_platform_fee_ledger enable row level security;

-- Public sale metadata: only active products are visible to everyone.
drop policy if exists "public_select_active_commerce_products"
  on public.commerce_products;
create policy "public_select_active_commerce_products"
  on public.commerce_products
  for select
  to anon, authenticated
  using (active = true);

drop policy if exists "owner_select_own_commerce_products"
  on public.commerce_products;
create policy "owner_select_own_commerce_products"
  on public.commerce_products
  for select
  to authenticated
  using ((select auth.uid()) = owner_user_id);

-- Purchases are private to the buyer and seller.
drop policy if exists "buyer_select_own_commerce_purchases"
  on public.commerce_purchases;
create policy "buyer_select_own_commerce_purchases"
  on public.commerce_purchases
  for select
  to authenticated
  using ((select auth.uid()) = buyer_user_id);

drop policy if exists "owner_select_commerce_purchases"
  on public.commerce_purchases;
create policy "owner_select_commerce_purchases"
  on public.commerce_purchases
  for select
  to authenticated
  using ((select auth.uid()) = owner_user_id);

-- Entitlements are readable by the recipient and seller.
drop policy if exists "user_select_own_commerce_entitlements"
  on public.commerce_entitlements;
create policy "user_select_own_commerce_entitlements"
  on public.commerce_entitlements
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "owner_select_commerce_entitlements"
  on public.commerce_entitlements;
create policy "owner_select_commerce_entitlements"
  on public.commerce_entitlements
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.commerce_products p
      where p.id = commerce_entitlements.product_id
        and p.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "party_select_commerce_subscription_checkouts"
  on public.commerce_subscription_checkouts;
create policy "party_select_commerce_subscription_checkouts"
  on public.commerce_subscription_checkouts
  for select
  to authenticated
  using (
    (select auth.uid()) = buyer_user_id
    or (select auth.uid()) = owner_user_id
  );

drop policy if exists "party_select_commerce_subscriptions"
  on public.commerce_subscriptions;
create policy "party_select_commerce_subscriptions"
  on public.commerce_subscriptions
  for select
  to authenticated
  using (
    (select auth.uid()) = buyer_user_id
    or (select auth.uid()) = owner_user_id
  );

drop policy if exists "owner_select_platform_fee_ledger"
  on public.commerce_platform_fee_ledger;
create policy "owner_select_platform_fee_ledger"
  on public.commerce_platform_fee_ledger
  for select
  to authenticated
  using ((select auth.uid()) = owner_user_id);

-- A paid entitlement grants SELECT access to a private work.
drop policy if exists "commerce_entitlement_select_work"
  on public.parari_books;
create policy "commerce_entitlement_select_work"
  on public.parari_books
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.commerce_entitlements e
      where e.work_id = parari_books.id
        and e.user_id = (select auth.uid())
        and e.status = 'active'
        and e.starts_at <= now()
        and (e.expires_at is null or e.expires_at > now())
        and (e.remaining_uses is null or e.remaining_uses > 0)
    )
  );

grant select on public.commerce_products to anon, authenticated;
grant select on public.commerce_purchases to authenticated;
grant select on public.commerce_entitlements to authenticated;
grant select on public.commerce_subscription_checkouts to authenticated;
grant select on public.commerce_subscriptions to authenticated;
grant select on public.commerce_platform_fee_ledger to authenticated;

grant select, insert, update, delete on public.commerce_products to service_role;
grant select, insert, update, delete on public.commerce_purchases to service_role;
grant select, insert, update, delete on public.commerce_entitlements to service_role;
grant select, insert, update, delete on public.commerce_subscription_checkouts to service_role;
grant select, insert, update, delete on public.commerce_subscriptions to service_role;
grant select, insert, update, delete on public.commerce_platform_fee_ledger to service_role;

create or replace function public.complete_commerce_square_payment(
  p_order_id text,
  p_payment_id text,
  p_amount numeric,
  p_currency text
)
returns table (
  purchase_id uuid,
  product_id uuid,
  work_id uuid,
  buyer_user_id uuid
)
language plpgsql
set search_path = ''
as $function$
declare
  v_purchase public.commerce_purchases%rowtype;
  v_product public.commerce_products%rowtype;
begin
  select *
  into v_purchase
  from public.commerce_purchases cp
  where cp.provider_order_id = p_order_id
  for update;

  if not found then
    raise exception 'commerce_purchase_not_found'
      using errcode = 'P0002';
  end if;

  if v_purchase.amount is distinct from p_amount
     or upper(v_purchase.currency) is distinct from upper(p_currency) then
    raise exception 'commerce_purchase_amount_mismatch'
      using errcode = '22023';
  end if;

  select *
  into v_product
  from public.commerce_products p
  where p.id = v_purchase.product_id;

  if not found then
    raise exception 'commerce_product_not_found'
      using errcode = 'P0002';
  end if;

  update public.commerce_purchases
  set
    provider_payment_id = p_payment_id,
    status = 'paid',
    completed_at = coalesce(completed_at, now()),
    updated_at = now()
  where id = v_purchase.id;

  if v_product.work_id is not null then
    insert into public.commerce_entitlements (
      user_id,
      product_id,
      work_id,
      source_purchase_id,
      status,
      starts_at,
      expires_at,
      remaining_uses,
      updated_at
    )
    values (
      v_purchase.buyer_user_id,
      v_product.id,
      v_product.work_id,
      v_purchase.id,
      'active',
      now(),
      null,
      null,
      now()
    )
    on conflict (user_id, product_id)
    do update set
      work_id = excluded.work_id,
      source_purchase_id = excluded.source_purchase_id,
      status = 'active',
      starts_at = least(public.commerce_entitlements.starts_at, excluded.starts_at),
      expires_at = null,
      remaining_uses = null,
      updated_at = now();
  end if;

  return query
  select
    v_purchase.id,
    v_product.id,
    v_product.work_id,
    v_purchase.buyer_user_id;
end;
$function$;

revoke all on function public.complete_commerce_square_payment(
  text, text, numeric, text
) from public, anon, authenticated;
grant execute on function public.complete_commerce_square_payment(
  text, text, numeric, text
) to service_role;

commit;
