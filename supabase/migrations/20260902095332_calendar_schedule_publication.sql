alter table public.calendar_schedules
  add column if not exists visibility text not null default 'private',
  add column if not exists show_in_profile boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'calendar_schedules_visibility_check'
  ) then
    alter table public.calendar_schedules
      add constraint calendar_schedules_visibility_check
      check (visibility in ('private', 'public'));
  end if;
end
$$;

comment on column public.calendar_schedules.visibility is
  'Public visibility of this class or event.';

comment on column public.calendar_schedules.show_in_profile is
  'Whether this public class or event appears on the owner profile.';
