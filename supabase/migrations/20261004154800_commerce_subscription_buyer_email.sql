-- 2026-10-05 JST
-- Add buyer email to recurring subscription records for Organizer customer management.

begin;

alter table public.commerce_subscriptions
  add column if not exists buyer_email text;

create index if not exists commerce_subscriptions_owner_status_idx
  on public.commerce_subscriptions(
    owner_user_id,
    status,
    created_at desc
  );

commit;
