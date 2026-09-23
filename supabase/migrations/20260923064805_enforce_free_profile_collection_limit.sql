create or replace function private.enforce_profile_collection_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_monitor boolean := false;
  has_active_paid_plan boolean := false;
  selected_work_count bigint := 0;
begin
  if coalesce(new.is_deleted, false)
    or new.show_in_profile_works is not true
  then
    return new;
  end if;

  select coalesce(profile.is_monitor, false)
  into is_monitor
  from public.profiles as profile
  where profile.user_id = new.owner;

  if coalesce(is_monitor, false) then
    return new;
  end if;

  select exists (
    select 1
    from public.user_billing as billing
    where billing.user_id = new.owner
      and billing.plan in ('plus', 'organizer', 'host', 'pro')
      and billing.billing_status in ('active', 'trialing')
  )
  into has_active_paid_plan;

  if has_active_paid_plan then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.owner::text, 1)
  );

  select count(*)
  into selected_work_count
  from public.parari_books as book
  where book.owner = new.owner
    and coalesce(book.is_deleted, false) = false
    and book.show_in_profile_works is true
    and (
      tg_op = 'INSERT'
      or book.id <> new.id
    );

  if selected_work_count >= 3 then
    raise exception using
      errcode = 'P0001',
      message = 'FREE_PROFILE_COLLECTION_LIMIT_REACHED',
      detail = 'Free plan users can select up to 3 representative works.';
  end if;

  return new;
end;
$$;

revoke all
on function private.enforce_profile_collection_limit()
from public, anon, authenticated;

drop trigger if exists enforce_profile_collection_limit
on public.parari_books;

create trigger enforce_profile_collection_limit
before insert or update of owner, is_deleted, show_in_profile_works
on public.parari_books
for each row
execute function private.enforce_profile_collection_limit();
