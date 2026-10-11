-- Admin-only aggregate. Never exposes message bodies, people, or thread IDs.
create or replace function public.cpp_alumni_message_activity()
returns table(messages_7d bigint, pairs_7d bigint, new_pairs_7d bigint)
language sql stable security definer set search_path = ''
as $$
  select
    (select count(*) from cpp_private.messages m where m.created_at >= now() - interval '7 days')::bigint,
    (select count(distinct m.thread_id) from cpp_private.messages m where m.created_at >= now() - interval '7 days')::bigint,
    (select count(*) from (
      select m.thread_id from cpp_private.messages m
      group by m.thread_id
      having min(m.created_at) >= now() - interval '7 days'
    ) v)::bigint
  where auth.uid() is not null
    and exists (select 1 from cpp_private.mode_users mu where mu.user_id=auth.uid() and mu.mode='admin');
$$;
revoke all on function public.cpp_alumni_message_activity() from public, anon;
grant execute on function public.cpp_alumni_message_activity() to authenticated;
