-- CALENDAR予約の一意性はAPPLICATIONではなく開催回に属する。
-- 同じユーザーが同じ開催回に複数の有効予約を持つことを防ぐ。

drop index if exists public.application_entries_booking_user_unique_idx;

create unique index application_entries_booking_user_unique_idx
on public.application_entries (
  calendar_occurrence_id,
  user_id
)
where calendar_occurrence_id is not null
  and user_id is not null
  and status = any (
    array[
      'submitted'::text,
      'confirmed'::text,
      'rejected'::text
    ]
  );
