create or replace function private.enforce_web_work_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_monitor boolean := false;
  effective_plan text := 'free';
  web_work_limit integer := 1;
  current_web_work_count bigint := 0;
  old_was_active_web boolean := false;
begin
  if coalesce(new.is_deleted, false)
    or coalesce(new.content, '') !~*
      '^[[:space:]]*\[(WEB|WEBINFO)([^[:alnum:]_]|$)'
  then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    old_was_active_web :=
      coalesce(old.is_deleted, false) = false
      and coalesce(old.content, '') ~*
        '^[[:space:]]*\[(WEB|WEBINFO)([^[:alnum:]_]|$)';

    if old_was_active_web
      and new.owner = old.owner
    then
      return new;
    end if;
  end if;

  select coalesce(profile.is_monitor, false)
  into is_monitor
  from public.profiles as profile
  where profile.user_id = new.owner;

  if coalesce(is_monitor, false) then
    return new;
  end if;

  select case
    when billing.plan in ('plus', 'organizer', 'host', 'pro')
      and billing.billing_status in ('active', 'trialing')
    then billing.plan
    else 'free'
  end
  into effective_plan
  from public.user_billing as billing
  where billing.user_id = new.owner;

  effective_plan := coalesce(effective_plan, 'free');

  case effective_plan
    when 'pro' then
      web_work_limit := null;
    when 'plus', 'organizer', 'host' then
      web_work_limit := 3;
    else
      web_work_limit := 1;
  end case;

  if web_work_limit is null then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.owner::text, 2)
  );

  select count(*)
  into current_web_work_count
  from public.parari_books as book
  where book.owner = new.owner
    and coalesce(book.is_deleted, false) = false
    and coalesce(book.content, '') ~*
      '^[[:space:]]*\[(WEB|WEBINFO)([^[:alnum:]_]|$)'
    and (
      tg_op = 'INSERT'
      or book.id <> new.id
    );

  if current_web_work_count >= web_work_limit then
    raise exception using
      errcode = 'P0001',
      message = 'PARARI_WEB_WORK_LIMIT_REACHED',
      detail = format(
        '%s plan allows %s WEB works. Current: %s.',
        effective_plan,
        web_work_limit,
        current_web_work_count
      );
  end if;

  return new;
end;
$$;

revoke all
on function private.enforce_web_work_limit()
from public, anon, authenticated;

drop trigger if exists enforce_web_work_limit
on public.parari_books;

create trigger enforce_web_work_limit
before insert or update of owner, is_deleted, content
on public.parari_books
for each row
execute function private.enforce_web_work_limit();
