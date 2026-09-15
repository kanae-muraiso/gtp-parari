create table if not exists public.matching_conversation_requests (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  thread_id uuid null references public.message_threads(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz null,
  constraint matching_conversation_requests_distinct_users check (requester_user_id <> target_user_id),
  constraint matching_conversation_requests_status_check check (status in ('pending','accepted','declined','cancelled'))
);

create index if not exists matching_conversation_requests_requester_idx
  on public.matching_conversation_requests(requester_user_id, created_at desc);
create index if not exists matching_conversation_requests_target_idx
  on public.matching_conversation_requests(target_user_id, created_at desc);
create unique index if not exists matching_conversation_requests_pending_direction_unique
  on public.matching_conversation_requests(membership_id, requester_user_id, target_user_id)
  where status = 'pending';

alter table public.matching_conversation_requests enable row level security;

create or replace function public.cpp_live_request_conversation(p_target_user_id uuid)
returns table(request_id uuid, request_status text, thread_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_membership_id uuid;
  v_existing_request public.matching_conversation_requests%rowtype;
  v_thread_id uuid;
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if p_target_user_id is null or p_target_user_id = v_me then raise exception 'Invalid target'; end if;

  select mm.membership_id into v_membership_id
  from public.membership_members mm
  join public.memberships m on m.id = mm.membership_id
  where mm.user_id = v_me
    and mm.status = 'active'
    and m.name = 'CPP'
    and m.membership_mode = 'matching'
  order by mm.created_at desc
  limit 1;

  if v_membership_id is null then raise exception 'CPP membership required'; end if;

  if not exists (
    select 1 from public.membership_members mm
    where mm.membership_id = v_membership_id
      and mm.user_id = p_target_user_id
      and mm.status = 'active'
  ) then
    raise exception 'Target is not an active CPP member';
  end if;

  select mt.id into v_thread_id
  from public.message_threads mt
  join public.message_thread_contexts c
    on c.thread_id = mt.id
   and c.context_type = 'membership'
   and c.context_id = v_membership_id
   and c.relationship_type = 'matching_live_direct'
   and c.status = 'active'
  where (mt.user_a_id = v_me and mt.user_b_id = p_target_user_id)
     or (mt.user_a_id = p_target_user_id and mt.user_b_id = v_me)
  limit 1;

  if v_thread_id is not null then
    return query select null::uuid, 'accepted'::text, v_thread_id;
    return;
  end if;

  select * into v_existing_request
  from public.matching_conversation_requests r
  where r.membership_id = v_membership_id
    and r.requester_user_id = v_me
    and r.target_user_id = p_target_user_id
    and r.status = 'pending'
  order by r.created_at desc
  limit 1;

  if v_existing_request.id is not null then
    return query select v_existing_request.id, v_existing_request.status, v_existing_request.thread_id;
    return;
  end if;

  insert into public.matching_conversation_requests(membership_id, requester_user_id, target_user_id)
  values (v_membership_id, v_me, p_target_user_id)
  returning id, status, thread_id into request_id, request_status, thread_id;
  return next;
end;
$$;

create or replace function public.cpp_live_respond_conversation(p_request_id uuid, p_accept boolean)
returns table(request_id uuid, request_status text, thread_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_req public.matching_conversation_requests%rowtype;
  v_a uuid;
  v_b uuid;
  v_thread_id uuid;
begin
  if v_me is null then raise exception 'Authentication required'; end if;

  select * into v_req
  from public.matching_conversation_requests r
  where r.id = p_request_id
  for update;

  if v_req.id is null then raise exception 'Request not found'; end if;
  if v_req.target_user_id <> v_me then raise exception 'Not allowed'; end if;
  if v_req.status <> 'pending' then
    return query select v_req.id, v_req.status, v_req.thread_id;
    return;
  end if;

  if not exists (
    select 1 from public.membership_members mm
    where mm.membership_id = v_req.membership_id
      and mm.user_id = v_me
      and mm.status = 'active'
  ) then raise exception 'CPP membership required'; end if;

  if not p_accept then
    update public.matching_conversation_requests
    set status = 'declined', responded_at = now()
    where id = v_req.id
    returning id, status, thread_id into request_id, request_status, thread_id;
    return next;
    return;
  end if;

  if v_req.requester_user_id::text < v_req.target_user_id::text then
    v_a := v_req.requester_user_id; v_b := v_req.target_user_id;
  else
    v_a := v_req.target_user_id; v_b := v_req.requester_user_id;
  end if;

  insert into public.message_threads(user_a_id, user_b_id)
  values (v_a, v_b)
  on conflict (user_a_id, user_b_id) do update
    set updated_at = now()
  returning id into v_thread_id;

  insert into public.message_thread_contexts(
    thread_id, context_type, context_id, relationship_type, status, user_a_role, user_b_role
  ) values (
    v_thread_id, 'membership', v_req.membership_id, 'matching_live_direct', 'active', 'member', 'member'
  )
  on conflict (thread_id, context_type, context_id) do update
    set relationship_type = 'matching_live_direct', status = 'active', ended_at = null;

  update public.matching_conversation_requests
  set status = 'accepted', responded_at = now(), thread_id = v_thread_id
  where id = v_req.id
  returning id, status, thread_id into request_id, request_status, thread_id;

  update public.matching_conversation_requests
  set status = 'cancelled', responded_at = now()
  where membership_id = v_req.membership_id
    and status = 'pending'
    and id <> v_req.id
    and ((requester_user_id = v_req.requester_user_id and target_user_id = v_req.target_user_id)
      or (requester_user_id = v_req.target_user_id and target_user_id = v_req.requester_user_id));

  return next;
end;
$$;

create or replace function public.cpp_live_cancel_conversation_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.matching_conversation_requests
  set status = 'cancelled', responded_at = now()
  where id = p_request_id
    and requester_user_id = auth.uid()
    and status = 'pending';
end;
$$;

create or replace function public.cpp_live_pending_requests()
returns table(
  request_id uuid,
  direction text,
  other_user_id uuid,
  display_name text,
  photo_url text,
  affiliation text,
  role_title text,
  organization_key text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with mine as (
    select mm.membership_id
    from public.membership_members mm
    join public.memberships m on m.id = mm.membership_id
    where mm.user_id = auth.uid()
      and mm.status = 'active'
      and m.name = 'CPP'
      and m.membership_mode = 'matching'
    order by mm.created_at desc
    limit 1
  ), rows as (
    select r.*,
      case when r.target_user_id = auth.uid() then 'incoming' else 'outgoing' end as direction,
      case when r.target_user_id = auth.uid() then r.requester_user_id else r.target_user_id end as other_user_id
    from public.matching_conversation_requests r
    join mine m on m.membership_id = r.membership_id
    where r.status = 'pending'
      and (r.requester_user_id = auth.uid() or r.target_user_id = auth.uid())
  )
  select
    rows.id,
    rows.direction,
    rows.other_user_id,
    coalesce(nullif(sp.display_name,''), nullif(p.display_name,''), nullif(p.username,''), 'PARARI USER'),
    coalesce(sp.photo_url, p.avatar_url),
    sp.affiliation,
    sp.role_title,
    org.organization_key,
    rows.created_at
  from rows
  join public.membership_members mm on mm.membership_id = rows.membership_id and mm.user_id = rows.other_user_id
  left join public.membership_organizations org on org.id = mm.organization_id
  left join public.parari_social_profiles sp on sp.user_id = rows.other_user_id
  left join public.profiles p on p.user_id = rows.other_user_id
  order by rows.created_at desc;
$$;

create or replace function public.cpp_live_active_threads()
returns table(
  thread_id uuid,
  other_user_id uuid,
  display_name text,
  photo_url text,
  affiliation text,
  role_title text,
  organization_key text,
  last_message_at timestamptz,
  last_message_body text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with mine as (
    select mm.membership_id
    from public.membership_members mm
    join public.memberships m on m.id = mm.membership_id
    where mm.user_id = auth.uid()
      and mm.status = 'active'
      and m.name = 'CPP'
      and m.membership_mode = 'matching'
    order by mm.created_at desc
    limit 1
  ), threads as (
    select mt.*,
      case when mt.user_a_id = auth.uid() then mt.user_b_id else mt.user_a_id end as other_user_id
    from public.message_threads mt
    join public.message_thread_contexts c on c.thread_id = mt.id
    join mine m on m.membership_id = c.context_id
    where c.context_type = 'membership'
      and c.relationship_type = 'matching_live_direct'
      and c.status = 'active'
      and (mt.user_a_id = auth.uid() or mt.user_b_id = auth.uid())
  )
  select
    threads.id,
    threads.other_user_id,
    coalesce(nullif(sp.display_name,''), nullif(p.display_name,''), nullif(p.username,''), 'PARARI USER'),
    coalesce(sp.photo_url, p.avatar_url),
    sp.affiliation,
    sp.role_title,
    org.organization_key,
    threads.last_message_at,
    threads.last_message_body
  from threads
  join mine m on true
  join public.membership_members mm on mm.membership_id = m.membership_id and mm.user_id = threads.other_user_id and mm.status = 'active'
  left join public.membership_organizations org on org.id = mm.organization_id
  left join public.parari_social_profiles sp on sp.user_id = threads.other_user_id
  left join public.profiles p on p.user_id = threads.other_user_id
  order by coalesce(threads.last_message_at, threads.updated_at) desc;
$$;

create or replace function public.cpp_live_messages(p_thread_id uuid)
returns table(message_id uuid, sender_user_id uuid, body text, created_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with allowed as (
    select mt.id
    from public.message_threads mt
    join public.message_thread_contexts c on c.thread_id = mt.id
    join public.memberships m on m.id = c.context_id
    join public.membership_members mm on mm.membership_id = m.id and mm.user_id = auth.uid() and mm.status = 'active'
    where mt.id = p_thread_id
      and (mt.user_a_id = auth.uid() or mt.user_b_id = auth.uid())
      and c.context_type = 'membership'
      and c.relationship_type = 'matching_live_direct'
      and c.status = 'active'
      and m.name = 'CPP'
      and m.membership_mode = 'matching'
    limit 1
  )
  select msg.id, msg.sender_user_id, msg.body, msg.created_at
  from public.messages msg
  join allowed a on a.id = msg.thread_id
  order by msg.created_at asc, msg.id asc
  limit 500;
$$;

create or replace function public.cpp_live_send_message(p_thread_id uuid, p_body text)
returns table(message_id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_body text := btrim(coalesce(p_body,''));
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then raise exception 'Message must be 1-2000 characters'; end if;

  if not exists (
    select 1
    from public.message_threads mt
    join public.message_thread_contexts c on c.thread_id = mt.id
    join public.memberships m on m.id = c.context_id
    join public.membership_members mm on mm.membership_id = m.id and mm.user_id = v_me and mm.status = 'active'
    where mt.id = p_thread_id
      and (mt.user_a_id = v_me or mt.user_b_id = v_me)
      and c.context_type = 'membership'
      and c.relationship_type = 'matching_live_direct'
      and c.status = 'active'
      and m.name = 'CPP'
      and m.membership_mode = 'matching'
  ) then raise exception 'Not allowed'; end if;

  insert into public.messages(thread_id, sender_user_id, body)
  values (p_thread_id, v_me, v_body)
  returning id, messages.created_at into message_id, created_at;

  update public.message_threads
  set updated_at = now(), last_message_at = created_at, last_message_body = v_body, last_sender_user_id = v_me
  where id = p_thread_id;

  return next;
end;
$$;

revoke all on public.matching_conversation_requests from anon, authenticated;
revoke all on function public.cpp_live_request_conversation(uuid) from public;
revoke all on function public.cpp_live_respond_conversation(uuid, boolean) from public;
revoke all on function public.cpp_live_cancel_conversation_request(uuid) from public;
revoke all on function public.cpp_live_pending_requests() from public;
revoke all on function public.cpp_live_active_threads() from public;
revoke all on function public.cpp_live_messages(uuid) from public;
revoke all on function public.cpp_live_send_message(uuid, text) from public;
grant execute on function public.cpp_live_request_conversation(uuid) to authenticated;
grant execute on function public.cpp_live_respond_conversation(uuid, boolean) to authenticated;
grant execute on function public.cpp_live_cancel_conversation_request(uuid) to authenticated;
grant execute on function public.cpp_live_pending_requests() to authenticated;
grant execute on function public.cpp_live_active_threads() to authenticated;
grant execute on function public.cpp_live_messages(uuid) to authenticated;
grant execute on function public.cpp_live_send_message(uuid, text) to authenticated;

drop policy if exists "cpp live presence read" on realtime.messages;
drop policy if exists "cpp live presence write" on realtime.messages;
drop policy if exists "cpp live channel read" on realtime.messages;
drop policy if exists "cpp live channel write" on realtime.messages;

create policy "cpp live channel read"
on realtime.messages
for select
to authenticated
using (
  extension in ('presence','broadcast')
  and public.cpp_can_join_live_topic((select realtime.topic()), (select auth.uid()))
);

create policy "cpp live channel write"
on realtime.messages
for insert
to authenticated
with check (
  extension in ('presence','broadcast')
  and public.cpp_can_join_live_topic((select realtime.topic()), (select auth.uid()))
);
