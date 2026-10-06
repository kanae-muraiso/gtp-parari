-- 2026-10-05 JST
-- Fix PL/pgSQL output-column ambiguity in commerce entitlement upsert.

begin;

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

  update public.commerce_purchases cp
  set
    provider_payment_id = p_payment_id,
    status = 'paid',
    completed_at = coalesce(cp.completed_at, now()),
    updated_at = now()
  where cp.id = v_purchase.id;

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
    on conflict on constraint commerce_entitlements_user_id_product_id_key
    do update set
      work_id = excluded.work_id,
      source_purchase_id = excluded.source_purchase_id,
      status = 'active',
      starts_at = least(
        public.commerce_entitlements.starts_at,
        excluded.starts_at
      ),
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
