-- Keep Square payment internals server-only.
-- RLS remains enabled as defense in depth; Data API roles also have no table privileges.

begin;

revoke all on table public.square_connections
  from anon, authenticated;

revoke all on table public.square_oauth_states
  from anon, authenticated;

revoke all on table public.application_payments
  from anon, authenticated;

revoke all on table public.square_webhook_events
  from anon, authenticated;

grant select, insert, update, delete
  on table public.square_connections
  to service_role;

grant select, insert, update, delete
  on table public.square_oauth_states
  to service_role;

grant select, insert, update, delete
  on table public.application_payments
  to service_role;

grant select, insert, update, delete
  on table public.square_webhook_events
  to service_role;

commit;
