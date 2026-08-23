-- PARARI CALENDAR recurring bookings
-- 2026-08-22 JST
--
-- 継続予約そのものを保存する。
--
-- calendar_recurring_bookings = 継続して参加する意思
-- application_entries         = 実際の各開催回の予約事実
--
-- 継続予約は calendar_item ではなく calendar_schedule に紐づける。

create table if not exists public.calendar_recurring_bookings (
  id uuid primary key
    default gen_random_uuid(),

  application_id uuid not null
    references public.applications(id)
    on delete cascade,

  calendar_schedule_id uuid not null
    references public.calendar_schedules(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  -- 継続予約を開始した開催回。
  -- 削除されても継続予約の履歴自体は残す。
  start_occurrence_id uuid
    references public.calendar_occurrences(id)
    on delete set null,

  -- recurrence上の開始位置。
  -- starts_atではなく、不変のsource_starts_atを使う。
  start_source_starts_at timestamptz not null,

  status text not null
    default 'active'
    check (
      status in (
        'active',
        'stopped'
      )
    ),

  started_at timestamptz not null
    default now(),

  stopped_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint calendar_recurring_bookings_stopped_check
    check (
      (
        status = 'active'
        and stopped_at is null
      )
      or
      (
        status = 'stopped'
        and stopped_at is not null
      )
    )
);


-- 同じ人が同じAPPLICATION・SCHEDULEについて
-- 同時に複数の継続予約を持たない。
--
-- 一度停止した後に再開した場合は、
-- 古い履歴を復活させず新しい行を作る。
create unique index if not exists
  calendar_recurring_bookings_active_unique
on public.calendar_recurring_bookings (
  application_id,
  calendar_schedule_id,
  user_id
)
where status = 'active';


create index if not exists
  calendar_recurring_bookings_schedule_active_idx
on public.calendar_recurring_bookings (
  calendar_schedule_id,
  status
);


create index if not exists
  calendar_recurring_bookings_user_idx
on public.calendar_recurring_bookings (
  user_id,
  status
);


-- 各開催回の予約が
-- どの継続予約から自動生成されたかを記録する。
--
-- NULL:
--   単発予約 / 通常APPLICATION
--
-- 値あり:
--   継続予約から生成された予約
alter table public.application_entries
  add column if not exists
    calendar_recurring_booking_id uuid
    references public.calendar_recurring_bookings(id)
    on delete set null;


create index if not exists
  application_entries_recurring_booking_idx
on public.application_entries (
  calendar_recurring_booking_id
)
where calendar_recurring_booking_id is not null;


-- クライアントから直接操作しない。
-- 操作はPARARI API（service role）経由。
alter table public.calendar_recurring_bookings
  enable row level security;
