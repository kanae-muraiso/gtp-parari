-- Prevent paid STUDIO subscriptions from being hidden as LIBRARY-only accounts.
-- A scheduled cancellation is still active until Stripe's actual end of access.
-- This trigger also protects direct client writes to user_workspace_preferences.
create schema if not exists parari_internal;
revoke all on schema parari_internal from public, anon, authenticated;

create or replace function parari_internal.require_free_before_studio_pause()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.studio_paused = true
    and (tg_op = 'INSERT' or old.studio_paused is distinct from true)
    and exists (
      select 1 from public.user_billing billing
      where billing.user_id = new.user_id
        and billing.billing_status in ('active', 'trialing', 'past_due', 'unpaid')
        and (
          billing.plan <> 'free'
          or billing.stripe_subscription_id is not null
        )
    )
  then
    raise exception 'PAID_STUDIO_PAUSE_NOT_ALLOWED'
      using errcode = 'P0001',
            hint = '有料プランの契約が終了してFreeへ戻ってからSTUDIOを休止してください。';
  end if;
  return new;
end;
$function$;

revoke all on function parari_internal.require_free_before_studio_pause()
  from public, anon, authenticated;

drop trigger if exists user_workspace_preferences_paid_pause_guard
  on public.user_workspace_preferences;
create trigger user_workspace_preferences_paid_pause_guard
before insert or update of studio_paused
on public.user_workspace_preferences
for each row
execute function parari_internal.require_free_before_studio_pause();
