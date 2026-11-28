-- Draft: CLASS-only Square event payments and refund reconciliation.
-- Keep the existing APPLICATION and commerce payment paths intact.
begin;
create table public.class_b_event_refunds (
 refund_id text primary key,
 payment_id uuid not null references public.application_payments(id) on delete restrict,
 provider_payment_id text not null,
 amount numeric not null check(amount>0),
 currency text not null,
 created_at timestamptz not null default now()
);
alter table public.class_b_event_refunds enable row level security;
revoke all on public.class_b_event_refunds from public,anon,authenticated;
grant select,insert on public.class_b_event_refunds to service_role;

create function public.class_b_square_event_complete(p_order_id text,p_payment_id text,p_merchant text,p_amount numeric,p_currency text)
returns table(entry_id uuid,entry_status text,was_expired boolean,handled boolean)
language plpgsql security invoker set search_path='' as $$
declare p public.application_payments%rowtype; e public.application_entries%rowtype; event_id uuid;
begin
 select a.id into event_id from public.application_payments ap
 join public.application_entries ae on ae.id=ap.entry_id
 join public.applications a on a.id=ae.application_id
 where ap.provider_order_id=p_order_id and a.class_event_school_id is not null;
 if not found then return; end if;
 -- Use the same parent-event lock order as check-in and registration.
 perform 1 from public.applications where id=event_id for update;
 select * into p from public.application_payments where provider_order_id=p_order_id for update;
 if not found then raise no_data_found; end if;
 if p.provider<>'square' or p.merchant_id is distinct from p_merchant
  or nullif(p_merchant,'') is null or nullif(p_payment_id,'') is null
  or p.amount is distinct from p_amount or upper(p.currency) is distinct from upper(p_currency)
  or (p.provider_payment_id is not null and p.provider_payment_id<>p_payment_id) then
  raise exception 'CLASS Square payment mismatch' using errcode='22023';
 end if;
 select * into e from public.application_entries where id=p.entry_id for update;
 if not found or e.application_id<>event_id then raise no_data_found; end if;
 -- Never revive a refunded entry; paid notices are idempotent.
 if p.status in ('paid','refunded','refund_pending') then
   return query select e.id,e.status,p.status='refund_pending',true; return;
 end if;
 return query select r.entry_id,r.entry_status,r.was_expired,true
 from public.complete_application_square_payment(p_order_id,p_payment_id,p_amount,p_currency) r;
end; $$;

create function public.class_b_square_event_refund(p_refund_id text,p_payment_id text,p_order_id text,p_merchant text,p_amount numeric,p_currency text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare p public.application_payments%rowtype; e public.application_entries%rowtype; event_id uuid;
 total numeric; existing public.class_b_event_refunds%rowtype;
begin
 select a.id into event_id from public.application_payments ap
 join public.application_entries ae on ae.id=ap.entry_id
 join public.applications a on a.id=ae.application_id
 where (ap.provider_payment_id=p_payment_id or (p_order_id is not null and ap.provider_order_id=p_order_id))
 and a.class_event_school_id is not null;
 if not found then return false; end if;
 perform 1 from public.applications where id=event_id for update;
 select * into p from public.application_payments ap where
 (ap.provider_payment_id=p_payment_id or (p_order_id is not null and ap.provider_order_id=p_order_id))
 and ap.entry_id in(select ae.id from public.application_entries ae where ae.application_id=event_id)
 for update;
 if not found then raise no_data_found; end if;
 if p.provider<>'square' or p.merchant_id is distinct from p_merchant
  or nullif(p_merchant,'') is null or nullif(p_payment_id,'') is null or nullif(p_refund_id,'') is null
  or p_amount is null or p_amount<=0 or p_amount>p.amount or upper(p.currency) is distinct from upper(p_currency)
  or (p.provider_payment_id is not null and p.provider_payment_id<>p_payment_id)
  or (p_order_id is not null and p.provider_order_id is distinct from p_order_id) then
   raise exception 'CLASS Square refund mismatch' using errcode='22023';
 end if;
 select * into e from public.application_entries where id=p.entry_id for update;
 if not found or e.application_id<>event_id then raise no_data_found; end if;
 insert into public.class_b_event_refunds(refund_id,payment_id,provider_payment_id,amount,currency)
 values(p_refund_id,p.id,p_payment_id,p_amount,upper(p_currency)) on conflict(refund_id) do nothing;
 select * into existing from public.class_b_event_refunds where refund_id=p_refund_id;
 if existing.payment_id<>p.id or existing.provider_payment_id<>p_payment_id or existing.amount<>p_amount or existing.currency<>upper(p_currency)
 then raise exception 'CLASS Square refund ID mismatch' using errcode='22023'; end if;
 select coalesce(sum(amount),0) into total from public.class_b_event_refunds where payment_id=p.id;
 if total>p.amount then raise exception 'CLASS Square refund exceeds payment' using errcode='22023'; end if;
 if total=p.amount then
   update public.application_payments set provider_payment_id=p_payment_id,status='refunded',
     refunded_at=coalesce(refunded_at,now()),updated_at=now() where id=p.id;
   update public.application_entries set payment_status='unpaid',
     status=case when status in ('submitted','confirmed') then 'cancelled' else status end,
     payment_confirmed_at=null,payment_hold_expires_at=null,updated_at=now()
     where id=e.id;
 end if;
 return true;
end; $$;
revoke all on function public.class_b_square_event_complete(text,text,text,numeric,text),public.class_b_square_event_refund(text,text,text,text,numeric,text) from public,anon,authenticated;
grant execute on function public.class_b_square_event_complete(text,text,text,numeric,text),public.class_b_square_event_refund(text,text,text,text,numeric,text) to service_role;
commit;
