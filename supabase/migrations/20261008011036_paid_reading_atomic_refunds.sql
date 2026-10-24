-- 2026-10-08 JST / PART: Idempotent purchase/refund transitions for paid reading

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

  -- A delayed/repeated payment must not restore a refunded, expired or manually
  -- revoked entitlement. The initial paid transition and grant are atomic below.
  if v_purchase.status in ('paid','refunded') or v_purchase.refunded_amount >= v_purchase.amount then
    return query select v_purchase.id,v_product.id,v_product.work_id,v_purchase.buyer_user_id;
    return;
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

create or replace function public.apply_commerce_square_refund(
 p_purchase_id uuid,p_refund_id text,p_amount numeric,p_currency text
) returns void language plpgsql set search_path='' as $$
declare
 purchase public.commerce_purchases%rowtype;
 total_refunded numeric;
 existing_refund public.commerce_refunds%rowtype;
begin
 select * into strict purchase from public.commerce_purchases where id=p_purchase_id for update;
 if p_amount<=0 or upper(p_currency)<>upper(purchase.currency) then raise exception 'Refund amount/currency mismatch'; end if;
 select * into existing_refund from public.commerce_refunds where provider_refund_id=p_refund_id;
 if found and (existing_refund.purchase_id<>p_purchase_id or existing_refund.amount<>p_amount or upper(existing_refund.currency)<>upper(p_currency)) then raise exception 'Refund identity mismatch'; end if;
 insert into public.commerce_refunds(purchase_id,owner_user_id,buyer_user_id,provider_refund_id,amount,currency,status,completed_at)
 values(purchase.id,purchase.owner_user_id,purchase.buyer_user_id,p_refund_id,p_amount,upper(p_currency),'completed',now())
 on conflict(provider_refund_id) do nothing;
 select coalesce(sum(amount),0) into total_refunded from public.commerce_refunds where purchase_id=p_purchase_id and status='completed';
 update public.commerce_purchases set refunded_amount=total_refunded,
 status=case when total_refunded>=amount then 'refunded' else status end,
 refunded_at=case when total_refunded>=amount then coalesce(refunded_at,now()) else refunded_at end,
 updated_at=now() where id=p_purchase_id;
 if total_refunded>=purchase.amount then
  update public.commerce_entitlements set status='revoked',updated_at=now() where source_purchase_id=p_purchase_id and user_id=purchase.buyer_user_id;
 end if;
end $$;
revoke all on function public.apply_commerce_square_refund(uuid,text,numeric,text) from public,anon,authenticated;
grant execute on function public.apply_commerce_square_refund(uuid,text,numeric,text) to service_role;
commit;
