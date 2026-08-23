-- PARARI CALENDAR
-- 2026-08-22
--
-- 同じ人・同じ開催回について
-- 「有効な予約」は1件だけ許可する。
--
-- cancelled / withdrawn は履歴として残し、
-- 後から再予約できるようにする。

drop index if exists
  public.application_entries_booking_user_unique_idx;

create unique index
  application_entries_booking_user_unique_idx
on public.application_entries (
  application_id,
  calendar_occurrence_id,
  user_id
)
where
  calendar_occurrence_id is not null
  and user_id is not null
  and status in (
    'submitted',
    'confirmed',
    'rejected'
  );
