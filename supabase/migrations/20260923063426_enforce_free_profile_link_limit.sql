create or replace function private.enforce_profile_link_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_monitor boolean := false;
  has_active_paid_plan boolean := false;
  enabled_link_count bigint := 0;
begin
  if new.is_enabled is not true then
    return new;
  end if;

  select coalesce(profile.is_monitor, false)
  into is_monitor
  from public.profiles as profile
  where profile.user_id = new.user_id;

  if coalesce(is_monitor, false) then
    return new;
  end if;

  select exists (
    select 1
    from public.user_billing as billing
    where billing.user_id = new.user_id
      and billing.plan in ('plus', 'organizer', 'host', 'pro')
      and billing.billing_status in ('active', 'trialing')
  )
  into has_active_paid_plan;

  if has_active_paid_plan then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 0)
  );

  select count(*)
  into enabled_link_count
  from public.profile_links as link
  where link.user_id = new.user_id
    and link.is_enabled is true
    and (
      tg_op = 'INSERT'
      or link.id <> new.id
    );

  if enabled_link_count >= 3 then
    raise exception using
      errcode = 'P0001',
      message = 'FREE_PROFILE_LINK_LIMIT_REACHED',
      detail = 'Free plan users can enable up to 3 profile links.';
  end if;

  return new;
end;
$$;

revoke all
on function private.enforce_profile_link_limit()
from public, anon, authenticated;

drop trigger if exists enforce_profile_link_limit
on public.profile_links;

create trigger enforce_profile_link_limit
before insert or update of user_id, is_enabled
on public.profile_links
for each row
execute function private.enforce_profile_link_limit();
