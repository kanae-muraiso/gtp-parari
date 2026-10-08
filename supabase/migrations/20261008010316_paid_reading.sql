-- supabase/migrations/20261008010316_paid_reading.sql
-- 2026-10-08 JST / PART: Paid reading; SSOT remains the only content master.
begin;
create table public.commerce_work_access (
 work_id uuid primary key references public.parari_books(id) on delete cascade,
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 one_time_product_id uuid references public.commerce_products(id) on delete restrict,
 subscription_product_id uuid references public.commerce_products(id) on delete restrict,
 updated_at timestamptz not null default now()
);
create index commerce_work_access_owner_idx on public.commerce_work_access(owner_user_id);
create index commerce_work_access_once_idx on public.commerce_work_access(one_time_product_id);
create index commerce_work_access_subscription_idx on public.commerce_work_access(subscription_product_id);
alter table public.commerce_work_access enable row level security;
create policy owner_read on public.commerce_work_access for select to authenticated using (owner_user_id=(select auth.uid()));
revoke all on public.commerce_work_access from anon, authenticated;
grant select on public.commerce_work_access to authenticated;
grant all on public.commerce_work_access to service_role;
-- Only the service API may write mappings; additionally enforce ownership in the DB.
create function public.validate_commerce_work_access() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.parari_books b where b.id=new.work_id and b.owner=new.owner_user_id) then raise exception 'Work owner mismatch'; end if;
 if new.one_time_product_id is not null and not exists(select 1 from public.commerce_products p where p.id=new.one_time_product_id and p.owner_user_id=new.owner_user_id and p.work_id=new.work_id and p.billing_interval='one_time') then raise exception 'Single purchase product mismatch'; end if;
 if new.subscription_product_id is not null and not exists(select 1 from public.commerce_products p where p.id=new.subscription_product_id and p.owner_user_id=new.owner_user_id and p.billing_interval='monthly') then raise exception 'Subscription product mismatch'; end if;
 return new;
end $$;
create trigger validate_work_access before insert or update on public.commerce_work_access for each row execute function public.validate_commerce_work_access();
revoke all on function public.validate_commerce_work_access() from public;
alter table public.commerce_subscriptions add column access_until timestamptz, add column access_invoice_id text;
create index commerce_subscription_reader_idx on public.commerce_subscriptions(buyer_user_id,product_id,access_until);
-- Only a verified PAID invoice matching the latest provider period can extend access.
-- GREATEST makes retries and out-of-order events non-additive and non-shortening.
create function public.grant_commerce_subscription_reading(p_subscription_id uuid,p_invoice_id text,p_until timestamptz)
returns void language sql security definer set search_path='' as $$
 update public.commerce_subscriptions set access_until=p_until, access_invoice_id=p_invoice_id
 where id=p_subscription_id and (access_until is null or access_until<=p_until);
$$;
revoke all on function public.grant_commerce_subscription_reading(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.grant_commerce_subscription_reading(uuid,text,timestamptz) to service_role;
-- Even existing permissive purchase/member policies cannot expose paid SSOT directly.
create policy paid_source_no_anonymous on public.parari_books as restrictive for select to anon using (
 coalesce(content,'') !~* '(^|[\r\n])[ \t]*\[PAYWALL\M'
);
create policy paid_source_author_only on public.parari_books as restrictive for select to authenticated using (
 coalesce(content,'') !~* '(^|[\r\n])[ \t]*\[PAYWALL\M'
 or owner=(select auth.uid())
 or exists(select 1 from public.parari_work_collaborators c where c.work_id=parari_books.id and c.user_id=(select auth.uid()) and c.role='editor')
);
-- Public catalog retains paid titles/URLs without returning their content.
-- Explicit public visibility is checked inside the definer view; no private rows.
create view public.parari_public_works with (security_barrier=true) as
 select id,owner,title,
 case when coalesce(content,'') ~* '(^|[\r\n])[ \t]*\[PAYWALL\M' then null else content end as content,
 is_public,created_at,updated_at,is_deleted,visibility,slug,stable_slug,custom_slug,expires_at,
 show_in_profile_works,profile_works_order,render_mode,physical_pagination,entry_mode,published_at
 from public.parari_books where is_deleted is not true and visibility in ('public','unlisted');
revoke all on public.parari_public_works from public,anon,authenticated;
grant select on public.parari_public_works to anon,authenticated,service_role;
commit;
