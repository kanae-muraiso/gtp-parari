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
set search_path to ''
as $function$
declare
  v_entry public.application_entries%rowtype;
  v_count integer := 0;
  v_application_check_in_started_at timestamptz;
  v_occurrence_check_in_started_at timestamptz;
begin
  if p_capacity_limit is not null and p_capacity_limit < 0 then
    raise exception 'application_capacity_limit_invalid'
      using errcode = '22023';
  end if;

  select a.check_in_started_at
  into v_application_check_in_started_at
  from public.applications a
  where a.id = p_application_id
  for update;

  if not found then
    raise exception 'application_not_found'
      using errcode = 'P0002';
  end if;

  if p_calendar_occurrence_id is null
     and v_application_check_in_started_at is not null then
    raise exception 'application_check_in_started'
      using errcode = 'P0001';
  end if;

  if p_calendar_occurrence_id is not null then
    select o.check_in_started_at
    into v_occurrence_check_in_started_at
    from public.calendar_occurrences o
    where o.id = p_calendar_occurrence_id
    for update;

    if not found then
      raise exception 'calendar_occurrence_not_found'
        using errcode = 'P0002';
    end if;

    if v_occurrence_check_in_started_at is not null then
      raise exception 'application_check_in_started'
        using errcode = 'P0001';
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

create or replace function public.cancel_application_entry_atomic(
  p_entry_id uuid,
  p_expected_status text,
  p_target_status text,
  p_user_id uuid default null,
  p_cancellation_token text default null
)
returns public.application_entries
language plpgsql
set search_path to ''
as $function$
declare
  v_entry public.application_entries%rowtype;
  v_check_in_started_at timestamptz;
  v_now timestamptz := now();
begin
  if p_target_status not in ('withdrawn', 'cancelled') then
    raise exception 'application_cancellation_target_invalid'
      using errcode = '22023';
  end if;

  if (p_user_id is null) = (p_cancellation_token is null) then
    raise exception 'application_cancellation_identity_invalid'
      using errcode = '22023';
  end if;

  select e.*
  into v_entry
  from public.application_entries e
  where e.id = p_entry_id
    and e.status = p_expected_status
    and e.checked_in_at is null
    and e.cancelled_at is null
    and (
      (p_user_id is not null and e.user_id = p_user_id)
      or
      (p_cancellation_token is not null and e.cancellation_token = p_cancellation_token)
    )
  for update;

  if not found then
    return null;
  end if;

  if v_entry.calendar_occurrence_id is not null then
    select o.check_in_started_at
    into v_check_in_started_at
    from public.calendar_occurrences o
    where o.id = v_entry.calendar_occurrence_id
    for update;
  else
    select a.check_in_started_at
    into v_check_in_started_at
    from public.applications a
    where a.id = v_entry.application_id
    for update;
  end if;

  if v_check_in_started_at is not null then
    raise exception 'application_check_in_started'
      using errcode = 'P0001';
  end if;

  update public.application_entries e
  set
    status = p_target_status,
    cancelled_at = v_now,
    updated_at = v_now
  where e.id = v_entry.id
  returning e.* into v_entry;

  return v_entry;
end;
$function$;

revoke execute on function public.cancel_application_entry_atomic(uuid, text, text, uuid, text)
from public, anon, authenticated;

grant execute on function public.cancel_application_entry_atomic(uuid, text, text, uuid, text)
to service_role;
