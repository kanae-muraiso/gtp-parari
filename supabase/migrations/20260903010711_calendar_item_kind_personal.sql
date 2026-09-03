alter table public.calendar_items
  add column if not exists kind text not null default 'managed';

alter table public.calendar_items
  drop constraint if exists calendar_items_kind_check;

alter table public.calendar_items
  add constraint calendar_items_kind_check
  check (kind = any (array['managed'::text, 'personal'::text]));

comment on column public.calendar_items.kind is
  'managed = managed class/event; personal = private personal calendar entry.';
