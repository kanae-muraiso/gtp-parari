create or replace function public.cpp_can_join_live_topic(p_topic text, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p_topic like 'cpp-live:%'
    and exists (
      select 1
      from public.membership_members mm
      join public.memberships m on m.id = mm.membership_id
      where mm.user_id = p_user_id
        and mm.status = 'active'
        and m.name = 'CPP'
        and m.membership_mode = 'matching'
        and mm.membership_id::text = substring(p_topic from 10)
    );
$$;

grant execute on function public.cpp_can_join_live_topic(text, uuid) to authenticated;

drop policy if exists "cpp live presence read" on realtime.messages;
create policy "cpp live presence read"
on realtime.messages
for select
to authenticated
using (
  extension = 'presence'
  and public.cpp_can_join_live_topic((select realtime.topic()), (select auth.uid()))
);

drop policy if exists "cpp live presence write" on realtime.messages;
create policy "cpp live presence write"
on realtime.messages
for insert
to authenticated
with check (
  extension = 'presence'
  and public.cpp_can_join_live_topic((select realtime.topic()), (select auth.uid()))
);
