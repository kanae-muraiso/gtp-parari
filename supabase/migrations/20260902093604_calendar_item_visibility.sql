alter table public.calendar_items
  add column if not exists visibility text not null default 'private';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'calendar_items_visibility_check'
  ) then
    alter table public.calendar_items
      add constraint calendar_items_visibility_check
      check (visibility in ('private', 'public'));
  end if;
end
$$;

comment on column public.calendar_items.visibility is
  'Public visibility of the CALENDAR item. private or public.';
