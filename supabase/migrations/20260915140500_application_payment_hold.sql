alter table public.applications
  drop constraint if exists applications_payment_method_check;

alter table public.applications
  add constraint applications_payment_method_check
  check (payment_method = any (array[
    'none'::text,
    'on_site'::text,
    'bank_transfer'::text,
    'payment_link'::text,
    'parari'::text
  ]));

alter table public.application_entries
  add column if not exists payment_hold_expires_at timestamptz,
  add column if not exists expired_at timestamptz;

alter table public.application_entries
  drop constraint if exists application_entries_status_check;

alter table public.application_entries
  add constraint application_entries_status_check
  check (status = any (array[
    'submitted'::text,
    'confirmed'::text,
    'rejected'::text,
    'withdrawn'::text,
    'cancelled'::text,
    'expired'::text
  ]));

create index if not exists application_entries_payment_hold_expiry_idx
  on public.application_entries (payment_hold_expires_at)
  where status = 'submitted'
    and payment_hold_expires_at is not null;

create or replace function public.set_application_entry_pricing()
returns trigger
language plpgsql
set search_path = ''
as $function$
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
  new.expired_at := null;

  if v_amount > 0 then
    new.payment_status := 'unpaid';

    v_payment_satisfied := case
      when v_payment_method = 'on_site' then true
      when v_payment_method in ('none', 'parari') then false
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

  if
    v_amount > 0
    and v_payment_method = 'parari'
    and v_acceptance_mode = 'instant'
  then
    new.payment_hold_expires_at := now() + interval '15 minutes';
  else
    new.payment_hold_expires_at := null;
  end if;

  new.status := case
    when v_qualification_satisfied and v_payment_satisfied
      then 'confirmed'
    else 'submitted'
  end;

  return new;
end;
$function$;

revoke all on function public.set_application_entry_pricing() from public;
revoke all on function public.set_application_entry_pricing() from anon;
revoke all on function public.set_application_entry_pricing() from authenticated;

create or replace function public.expire_application_payment_holds(
  p_application_id uuid,
  p_calendar_occurrence_id uuid
)
returns integer
language plpgsql
set search_path = ''
as $function$
declare
  v_expired_count integer := 0;
begin
  if p_calendar_occurrence_id is not null then
    update public.application_entries e
    set
      status = 'expired',
      expired_at = coalesce(e.expired_at, now()),
      updated_at = now()
    where e.calendar_occurrence_id = p_calendar_occurrence_id
      and e.status = 'submitted'
      and e.payment_status = 'unpaid'
      and e.payment_hold_expires_at is not null
      and e.payment_hold_expires_at <= now();
  else
    update public.application_entries e
    set
      status = 'expired',
      expired_at = coalesce(e.expired_at, now()),
      updated_at = now()
    where e.application_id = p_application_id
      and e.calendar_occurrence_id is null
      and e.status = 'submitted'
      and e.payment_status = 'unpaid'
      and e.payment_hold_expires_at is not null
      and e.payment_hold_expires_at <= now();
  end if;

  get diagnostics v_expired_count = row_count;
  return v_expired_count;
end;
$function$;

revoke all on function public.expire_application_payment_holds(uuid, uuid) from public;
revoke all on function public.expire_application_payment_holds(uuid, uuid) from anon;
revoke all on function public.expire_application_payment_holds(uuid, uuid) from authenticated;
grant execute on function public.expire_application_payment_holds(uuid, uuid) to service_role;

create or replace function public.create_application_entry_atomic(
  p_application_id uuid,
  p_application_version integer,
  p_application_snapshot jsonb,
  p_answers jsonb,
  p_capacity_limit integer,
  p_user_id uuid,
  p_applicant_name text,
  p_applicant_email text,
  p_calendar_occurrence_id uuid,
  p_form_submission_id uuid
)
returns public.application_entries
language plpgsql
set search_path = ''
as $function$
declare
  v_entry public.application_entries%rowtype;
  v_count integer := 0;
begin
  if p_capacity_limit is not null and p_capacity_limit < 0 then
    raise exception 'application_capacity_limit_invalid'
      using errcode = '22023';
  end if;

  perform 1
  from public.applications a
  where a.id = p_application_id
  for update;

  if not found then
    raise exception 'application_not_found'
      using errcode = 'P0002';
  end if;

  if p_calendar_occurrence_id is not null then
    perform 1
    from public.calendar_occurrences o
    where o.id = p_calendar_occurrence_id
    for update;

    if not found then
      raise exception 'calendar_occurrence_not_found'
        using errcode = 'P0002';
    end if;
  end if;

  perform public.expire_application_payment_holds(
    p_application_id,
    p_calendar_occurrence_id
  );

  if p_calendar_occurrence_id is not null then
    select count(*)::integer
    into v_count
    from public.application_entries e
    where e.calendar_occurrence_id = p_calendar_occurrence_id
      and e.status in ('submitted', 'confirmed');
  else
    select count(*)::integer
    into v_count
    from public.application_entries e
    where e.application_id = p_application_id
      and e.calendar_occurrence_id is null
      and e.status in ('submitted', 'confirmed');
  end if;

  if p_capacity_limit is not null and v_count >= p_capacity_limit then
    raise exception 'application_capacity_reached'
      using errcode = 'P0001';
  end if;

  insert into public.application_entries (
    application_id,
    application_version,
    user_id,
    applicant_name,
    applicant_email,
    calendar_occurrence_id,
    form_submission_id,
    answers,
    application_snapshot
  )
  values (
    p_application_id,
    p_application_version,
    p_user_id,
    p_applicant_name,
    p_applicant_email,
    p_calendar_occurrence_id,
    p_form_submission_id,
    coalesce(p_answers, '{}'::jsonb),
    p_application_snapshot
  )
  returning * into v_entry;

  return v_entry;
end;
$function$;

revoke all on function public.create_application_entry_atomic(
  uuid, integer, jsonb, jsonb, integer,
  uuid, text, text, uuid, uuid
) from public;
revoke all on function public.create_application_entry_atomic(
  uuid, integer, jsonb, jsonb, integer,
  uuid, text, text, uuid, uuid
) from anon;
revoke all on function public.create_application_entry_atomic(
  uuid, integer, jsonb, jsonb, integer,
  uuid, text, text, uuid, uuid
) from authenticated;
grant execute on function public.create_application_entry_atomic(
  uuid, integer, jsonb, jsonb, integer,
  uuid, text, text, uuid, uuid
) to service_role;
