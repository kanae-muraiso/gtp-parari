-- Refund Square payments that arrive after an APPLICATION became inactive.
-- Never revive cancelled / withdrawn / rejected entries from an old checkout URL.

begin;

create or replace function public.complete_application_square_payment(
  p_order_id text,
  p_payment_id text,
  p_amount numeric,
  p_currency text
)
returns table (
  entry_id uuid,
  entry_status text,
  was_expired boolean
)
language plpgsql
set search_path = ''
as $function$
declare
  v_payment public.application_payments%rowtype;
  v_entry public.application_entries%rowtype;
  v_hold_expired boolean := false;
  v_refund_required boolean := false;
begin
  select *
  into v_payment
  from public.application_payments ap
  where ap.provider_order_id = p_order_id
  for update;

  if not found then
    raise exception 'application_payment_not_found'
      using errcode = 'P0002';
  end if;

  if v_payment.amount is distinct from p_amount
     or upper(v_payment.currency) is distinct from upper(p_currency) then
    raise exception 'application_payment_amount_mismatch'
      using errcode = '22023';
  end if;

  select *
  into v_entry
  from public.application_entries ae
  where ae.id = v_payment.entry_id
  for update;

  if not found then
    raise exception 'application_entry_not_found'
      using errcode = 'P0002';
  end if;

  v_hold_expired :=
    v_entry.status in ('submitted', 'confirmed')
    and v_entry.payment_status = 'unpaid'
    and v_entry.payment_hold_expires_at is not null
    and v_entry.payment_hold_expires_at <= now();

  v_refund_required :=
    v_entry.status not in ('submitted', 'confirmed')
    or v_hold_expired;

  update public.application_payments
  set
    provider_payment_id = p_payment_id,
    status = case
      when v_refund_required then 'refund_pending'
      else 'paid'
    end,
    completed_at = now(),
    updated_at = now()
  where id = v_payment.id;

  if not v_refund_required then
    update public.application_entries
    set
      payment_status = 'paid',
      payment_confirmed_at = now(),
      payment_hold_expires_at = null,
      status = case
        when qualification_status in ('not_required','approved')
          then 'confirmed'
        else status
      end,
      updated_at = now()
    where id = v_entry.id
    returning * into v_entry;
  elsif v_hold_expired then
    update public.application_entries
    set
      status = 'expired',
      expired_at = coalesce(expired_at, now()),
      updated_at = now()
    where id = v_entry.id
    returning * into v_entry;
  end if;

  return query
  select v_entry.id, v_entry.status, v_refund_required;
end;
$function$;

revoke all on function public.complete_application_square_payment(
  text, text, numeric, text
) from public, anon, authenticated;

grant execute on function public.complete_application_square_payment(
  text, text, numeric, text
) to service_role;

commit;
