-- STUDIO is an opt-in workspace. Pausing it must override historical
-- ownership of works/forms without deleting or unpublishing any content.
alter table public.user_workspace_preferences
  add column if not exists studio_paused boolean not null default false;

comment on column public.user_workspace_preferences.studio_paused is
  'Explicitly hides STUDIO from the member until they choose to resume; does not affect existing works or contracts.';

create or replace function public.get_my_parari_experience()
returns table (
  studio_enabled boolean,
  has_applications boolean,
  has_calendar boolean,
  has_messages boolean
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with me as (
    select auth.uid() as user_id
  )
  select
    (
      not coalesce((
        select uwp.studio_paused
        from public.user_workspace_preferences uwp, me
        where uwp.user_id = me.user_id
      ), false)
      and (
        coalesce((
          select uwp.studio_enabled
          from public.user_workspace_preferences uwp, me
          where uwp.user_id = me.user_id
        ), false)
        or exists (
          select 1 from public.parari_books b, me
          where b.owner = me.user_id
            and coalesce(b.is_deleted, false) = false
        )
        or exists (
          select 1 from public.forms f, me
          where f.owner_user_id = me.user_id
        )
        or exists (
          select 1 from public.applications a, me
          where a.owner_user_id = me.user_id
        )
        or exists (
          select 1 from public.memberships m, me
          where m.owner_user_id = me.user_id
        )
        or exists (
          select 1 from public.calendar_items ci, me
          where ci.owner_user_id = me.user_id
            and coalesce(ci.kind, 'managed') <> 'personal'
        )
      )
    ) as studio_enabled,

    exists (
      select 1 from public.application_entries ae, me
      where ae.user_id = me.user_id
    ) as has_applications,

    (
      exists (
        select 1 from public.calendar_recurring_bookings crb, me
        where crb.user_id = me.user_id
      )
      or exists (
        select 1 from public.application_entries ae, me
        where ae.user_id = me.user_id
          and (ae.calendar_occurrence_id is not null
               or ae.calendar_recurring_booking_id is not null)
      )
      or exists (
        select 1 from public.calendar_items ci, me
        where ci.owner_user_id = me.user_id
          and ci.kind = 'personal'
      )
    ) as has_calendar,

    exists (
      select 1 from public.message_threads mt, me
      where mt.user_a_id = me.user_id
         or mt.user_b_id = me.user_id
    ) as has_messages
  from me;
$function$;
