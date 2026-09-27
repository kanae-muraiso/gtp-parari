-- Keep Square Sandbox and Production OAuth connections separate.

begin;

alter table public.square_connections
  add column if not exists environment text;

update public.square_connections
set environment = 'sandbox'
where environment is null;

alter table public.square_connections
  alter column environment set not null;

alter table public.square_connections
  add constraint square_connections_environment_check
  check (environment in ('sandbox','production'));

alter table public.square_connections
  drop constraint if exists square_connections_pkey;

alter table public.square_connections
  add constraint square_connections_pkey
  primary key (owner_user_id, environment);

commit;
