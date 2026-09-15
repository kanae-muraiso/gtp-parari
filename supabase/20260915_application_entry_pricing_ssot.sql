-- APPLICATION v3 pricing SSOT
--
-- Booking price is frozen on application_entries at insert time.
-- - CALENDAR booking: selected calendar_occurrence is the price SSOT.
-- - Non-CALENDAR application: applications is the price SSOT.
--
-- Existing entries are backfilled from their application_snapshot first so
-- historical booking-time prices are preserved wherever possible.

alter table public.application_entries
  add column if not exists pricing_source text,
  add column if not exists pricing_amount numeric,
  add column if not exists pricing_currency text;

with resolved_pricing as (
  select
    ae.id,
    case
      when ae.calendar_occurrence_id is not null then 'calendar_occurrence'
      else 'application'
    end as pricing_source,
    case
      when ae.calendar_occurrence_id is not null then
        coalesce(
          case
            when coalesce(ae.application_snapshot #>> '{calendar_occurrence,fee_amount}', '') ~ '^[0-9]+([.][0-9]+)?$'
            then (ae.application_snapshot #>> '{calendar_occurrence,fee_amount}')::numeric
            else null
          end,
          co.fee_amount,
          0
        )
      else
        coalesce(
          case
            when coalesce(ae.application_snapshot ->> 'payment_amount', '') ~ '^[0-9]+([.][0-9]+)?$'
            then (ae.application_snapshot ->> 'payment_amount')::numeric
            else null
          end,
          a.payment_amount,
          0
        )
    end as pricing_amount,
    case
      when ae.calendar_occurrence_id is not null then
        coalesce(
          nullif(ae.application_snapshot #>> '{calendar_occurrence,fee_currency}', ''),
          co.fee_currency,
          'JPY'
        )
      else
        coalesce(
          nullif(ae.application_snapshot ->> 'payment_currency', ''),
          a.payment_currency,
          'JPY'
        )
    end as pricing_currency
  from public.application_entries ae
  join public.applications a
    on a.id = ae.application_id
  left join public.calendar_occurrences co
    on co.id = ae.calendar_occurrence_id
  where
    ae.pricing_source is null
    or ae.pricing_amount is null
    or ae.pricing_currency is null
)
update public.application_entries ae
set
  pricing_source = rp.pricing_source,
  pricing_amount = rp.pricing_amount,
  pricing_currency = rp.pricing_currency
from resolved_pricing rp
where rp.id = ae.id;

alter table public.application_entries
  alter column pricing_source set not null,
  alter column pricing_amount set not null,
  alter column pricing_currency set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'application_entries_pricing_source_check'
      and conrelid = 'public.application_entries'::regclass
  ) then
    alter table public.application_entries
      add constraint application_entries_pricing_source_check
        check (pricing_source in ('application', 'calendar_occurrence'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'application_entries_pricing_amount_check'
      and conrelid = 'public.application_entries'::regclass
  ) then
    alter table public.application_entries
      add constraint application_entries_pricing_amount_check
        check (pricing_amount >= 0);
  end if;
end
$$;

create or replace function public.set_application_entry_pricing()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_amount numeric;
  v_currency text;
begin
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
    new.pricing_amount := v_amount;
    new.pricing_currency := v_currency;
  else
    select
      coalesce(a.payment_amount, 0),
      coalesce(nullif(a.payment_currency, ''), 'JPY')
    into v_amount, v_currency
    from public.applications a
    where a.id = new.application_id;

    if not found then
      raise exception 'application not found for application entry';
    end if;

    new.pricing_source := 'application';
    new.pricing_amount := v_amount;
    new.pricing_currency := v_currency;
  end if;

  return new;
end;
$$;

revoke all on function public.set_application_entry_pricing() from public;
revoke all on function public.set_application_entry_pricing() from anon;
revoke all on function public.set_application_entry_pricing() from authenticated;

drop trigger if exists application_entries_set_pricing_before_insert
  on public.application_entries;

create trigger application_entries_set_pricing_before_insert
before insert on public.application_entries
for each row
execute function public.set_application_entry_pricing();
