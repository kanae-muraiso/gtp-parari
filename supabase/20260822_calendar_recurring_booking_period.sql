-- PARARI CALENDAR
-- 2026-08-22
--
-- 継続予約の期間と更新リマインド
--
-- end_on
--   NULL = 期間を決めず継続
--   DATE = この日まで参加
--
-- remind_on
--   NULL = 通知しない
--   DATE = この日に継続確認を知らせる

alter table public.calendar_recurring_bookings
  add column if not exists
    end_on date;

alter table public.calendar_recurring_bookings
  add column if not exists
    remind_on date;


alter table public.calendar_recurring_bookings
  drop constraint if exists
    calendar_recurring_bookings_remind_on_check;

alter table public.calendar_recurring_bookings
  add constraint
    calendar_recurring_bookings_remind_on_check
  check (
    remind_on is null
    or (
      end_on is not null
      and remind_on <= end_on
    )
  );


create index if not exists
  calendar_recurring_bookings_end_on_idx
on public.calendar_recurring_bookings (
  end_on
)
where
  status = 'active'
  and end_on is not null;


create index if not exists
  calendar_recurring_bookings_remind_on_idx
on public.calendar_recurring_bookings (
  remind_on
)
where
  status = 'active'
  and remind_on is not null;
