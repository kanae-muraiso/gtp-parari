-- Keep the billing table compatible with PARARI's five-plan SSOT.

begin;

alter table public.user_billing
drop constraint if exists user_billing_plan_check;

alter table public.user_billing
add constraint user_billing_plan_check
check (plan in ('free', 'plus', 'organizer', 'host', 'pro'))
not valid;

alter table public.user_billing
validate constraint user_billing_plan_check;

commit;
