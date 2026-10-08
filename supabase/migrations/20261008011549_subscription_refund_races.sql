-- 2026-10-08 JST / PART: Serialize refund revocation against in-flight paid responses
begin;
alter table public.commerce_subscriptions add column revoked_invoice_ids text[] not null default '{}';
create or replace function public.grant_commerce_subscription_reading(p_subscription_id uuid,p_invoice_id text,p_until timestamptz)
returns void language sql security definer set search_path='' as $$
 update public.commerce_subscriptions set access_until=p_until,access_invoice_id=p_invoice_id
 where id=p_subscription_id and not(p_invoice_id=any(revoked_invoice_ids))
 and (access_until is null or access_until<=p_until);
$$;
create function public.revoke_commerce_subscription_reading(p_subscription_id uuid,p_invoice_id text)
returns void language sql security definer set search_path='' as $$
 update public.commerce_subscriptions set
 revoked_invoice_ids=case when p_invoice_id=any(revoked_invoice_ids) then revoked_invoice_ids else array_append(revoked_invoice_ids,p_invoice_id) end,
 access_until=case when access_invoice_id=p_invoice_id then null else access_until end
 where id=p_subscription_id;
$$;
revoke all on function public.revoke_commerce_subscription_reading(uuid,text) from public,anon,authenticated;
grant execute on function public.revoke_commerce_subscription_reading(uuid,text) to service_role;
commit;
