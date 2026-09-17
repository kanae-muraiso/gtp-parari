create or replace function public.require_active_check_in_for_entry()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_origin text;
  v_check_in_started_at timestamptz;
begin
  if old.checked_in_at is null
     and new.checked_in_at is not null then
    select a.origin, a.check_in_started_at
    into v_origin, v_check_in_started_at
    from public.applications a
    where a.id = new.application_id
    for update;

    if not found then
      raise exception 'application_not_found'
        using errcode = 'P0002';
    end if;

    if v_origin = 'calendar' then
      if new.calendar_occurrence_id is null then
        raise exception 'calendar_occurrence_not_found'
          using errcode = 'P0002';
      end if;

      select o.check_in_started_at
      into v_check_in_started_at
      from public.calendar_occurrences o
      where o.id = new.calendar_occurrence_id
      for update;

      if not found then
        raise exception 'calendar_occurrence_not_found'
          using errcode = 'P0002';
      end if;
    end if;

    if v_check_in_started_at is null then
      raise exception 'application_check_in_not_started'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists application_entries_require_active_check_in
on public.application_entries;

create trigger application_entries_require_active_check_in
before update of checked_in_at on public.application_entries
for each row
execute function public.require_active_check_in_for_entry();

revoke execute on function public.require_active_check_in_for_entry()
from public, anon, authenticated;

create or replace function public.cancel_application_check_in_start_atomic(
  p_application_id uuid,
  p_occurrence_id uuid default null
)
returns text
language plpgsql
set search_path to ''
as $function$
declare
  v_origin text;
  v_calendar_item_id uuid;
  v_started_at timestamptz;
begin
  select a.origin, a.calendar_item_id, a.check_in_started_at
  into v_origin, v_calendar_item_id, v_started_at
  from public.applications a
  where a.id = p_application_id
  for update;

  if not found then
    raise exception 'application_not_found'
      using errcode = 'P0002';
  end if;

  if v_origin = 'calendar' then
    if p_occurrence_id is null then
      raise exception 'calendar_occurrence_required'
        using errcode = '22023';
    end if;

    select o.check_in_started_at
    into v_started_at
    from public.calendar_occurrences o
    where o.id = p_occurrence_id
      and o.calendar_item_id = v_calendar_item_id
    for update;

    if not found then
      raise exception 'calendar_occurrence_not_found'
        using errcode = 'P0002';
    end if;

    if v_started_at is null then
      return 'not_started';
    end if;

    if exists (
      select 1
      from public.application_entries e
      where e.application_id = p_application_id
        and e.calendar_occurrence_id = p_occurrence_id
        and e.checked_in_at is not null
    ) then
      return 'has_checkins';
    end if;

    update public.calendar_occurrences o
    set check_in_started_at = null
    where o.id = p_occurrence_id
      and o.calendar_item_id = v_calendar_item_id;

    return 'cancelled';
  end if;

  if p_occurrence_id is not null then
    raise exception 'calendar_occurrence_not_allowed'
      using errcode = '22023';
  end if;

  if v_started_at is null then
    return 'not_started';
  end if;

  if exists (
    select 1
    from public.application_entries e
    where e.application_id = p_application_id
      and e.calendar_occurrence_id is null
      and e.checked_in_at is not null
  ) then
    return 'has_checkins';
  end if;

  update public.applications a
  set check_in_started_at = null
  where a.id = p_application_id;

  return 'cancelled';
end;
$function$;

revoke execute on function public.cancel_application_check_in_start_atomic(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.cancel_application_check_in_start_atomic(uuid, uuid)
to service_role;
