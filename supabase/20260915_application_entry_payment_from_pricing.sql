-- APPLICATION v3 payment state from pricing SSOT
--
-- The authoritative booking price was already separated in
-- 20260915_application_entry_pricing_ssot.sql:
-- - CALENDAR booking => calendar_occurrences.fee_amount
-- - non-CALENDAR booking => applications.payment_amount
--
-- This migration makes payment state follow that authoritative price instead
-- of treating applications.payment_method = 'none' as proof that a booking is
-- free.

-- Backward compatibility: before price/payment were separated, paid CALENDAR
-- applications commonly used payment_method = 'none'. PARARI does not yet
-- offer online payment, so existing paid configurations are interpreted as
-- on-site payment rather than silently becoming free.
with paid_calendar_applications as (
  select distinct a.id
  from public.applications a
  join public.calendar_occurrences co
    on co.calendar_item_id = a.calendar_item_id
  where a.payment_method = 'none'
    and a.origin = 'calendar'
    and coalesce(co.fee_amount, 0) > 0

  union

  select distinct a.id
  from public.applications a
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(a.definition->'blocks') = 'array'
        then a.definition->'blocks'
      else '[]'::jsonb
    end
  ) as block
  join public.calendar_occurrences co
    on co.calendar_item_id::text = block->>'calendarItemId'
  where a.payment_method = 'none'
    and block->>'type' = 'calendar'
    and coalesce(co.fee_amount, 0) > 0
),
paid_manual_applications as (
  select a.id
  from public.applications a
  where a.payment_method = 'none'
    and coalesce(a.payment_amount, 0) > 0
),
applications_to_normalize as (
  select id from paid_calendar_applications
  union
  select id from paid_manual_applications
)
update public.applications a
set payment_method = 'on_site'
where a.id in (
  select id
  from applications_to_normalize
);

-- Repair legacy entry payment states using the already-frozen booking price.
-- Do not overwrite explicit payment reports or confirmed payments.
update public.application_entries ae
set payment_status = case
  when ae.pricing_amount > 0 then 'unpaid'
  else 'not_required'
end
where ae.payment_status in ('not_required', 'unpaid')
  and ae.payment_status is distinct from case
    when ae.pricing_amount > 0 then 'unpaid'
    else 'not_required'
  end;

-- Extend the existing pricing trigger so every future entry derives both its
-- frozen price and its initial payment/qualification/status from the same
-- authoritative data.
create or replace function public.set_application_entry_pricing()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_amount numeric;
  v_currency text;
  v_application_amount numeric;
  v_application_currency text;
  v_payment_method text;
  v_payment_confirmation_required boolean;
  v_acceptance_mode text;
  v_payment_satisfied boolean;
  v_qualification_satisfied boolean;
begin
  select
    coalesce(a.payment_amount, 0),
    coalesce(nullif(a.payment_currency, ''), 'JPY'),
    a.payment_method,
    coalesce(a.payment_confirmation_required, false),
    a.acceptance_mode
  into
    v_application_amount,
    v_application_currency,
    v_payment_method,
    v_payment_confirmation_required,
    v_acceptance_mode
  from public.applications a
  where a.id = new.application_id;

  if not found then
    raise exception 'application not found for application entry';
  end if;

  if new.calendar_occurrence_id is not null then
    select
      coalesce(o.fee_amount, 0),
      coalesce(nullif(o.fee_currency, ''), 'JPY')
    into v_amount, v_currency
    from public.calendar_occurrences o
    where o.id = new.calendar_occurrence_id;

    if not found then
      raise exception 'calendar occurrence not found for application entry';
    end if;

    new.pricing_source := 'calendar_occurrence';
  else
    v_amount := v_application_amount;
    v_currency := v_application_currency;
    new.pricing_source := 'application';
  end if;

  new.pricing_amount := v_amount;
  new.pricing_currency := v_currency;

  if v_amount > 0 then
    new.payment_status := 'unpaid';

    -- On-site payment never blocks the reservation itself. Legacy bank/link
    -- methods keep their existing confirmation-required behavior. A paid
    -- booking with method 'none' is treated as misconfigured and therefore
    -- cannot become confirmed or receive an active QR pass.
    v_payment_satisfied := case
      when v_payment_method = 'on_site' then true
      when v_payment_method = 'none' then false
      else not v_payment_confirmation_required
    end;
  else
    new.payment_status := 'not_required';
    v_payment_satisfied := true;
  end if;

  if v_acceptance_mode = 'approval' then
    new.qualification_status := 'pending';
    v_qualification_satisfied := false;
  else
    new.qualification_status := 'not_required';
    v_qualification_satisfied := true;
  end if;

  new.status := case
    when v_qualification_satisfied and v_payment_satisfied
      then 'confirmed'
    else 'submitted'
  end;

  return new;
end;
$$;

revoke all on function public.set_application_entry_pricing()
from public, anon, authenticated;
