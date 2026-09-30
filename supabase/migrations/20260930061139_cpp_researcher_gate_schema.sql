create schema if not exists cpp_security;
revoke all on schema cpp_security from public,anon;
alter function cpp_private.can_read_researcher(uuid) set schema cpp_security;
grant usage on schema cpp_security to authenticated;
revoke all on schema cpp_private from public,anon,authenticated;
