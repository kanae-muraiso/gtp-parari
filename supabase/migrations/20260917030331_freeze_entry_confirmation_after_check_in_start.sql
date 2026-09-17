create or replace function public.prevent_application_entry_confirmation_after_check_in_start()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_origin text;
  v_check_in_started_at timestamptz;
begin
  if old.status is distinct from 'confirmed'
     and new.status = 'confirmed' then
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

    if v_check_in_started_at is not null then
      raise exception 'application_check_in_started'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists application_entries_prevent_confirmation_after_check_in_start
on public.application_entries;

create trigger application_entries_prevent_confirmation_after_check_in_start
before update of status on public.application_entries
for each row
execute function public.prevent_application_entry_confirmation_after_check_in_start();

revoke execute on function public.prevent_application_entry_confirmation_after_check_in_start()
from public, anon, authenticated;
