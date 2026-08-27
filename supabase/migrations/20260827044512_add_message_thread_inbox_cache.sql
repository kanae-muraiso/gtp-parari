alter table public.message_threads
  add column if not exists last_message_body text null,
  add column if not exists last_sender_user_id uuid null references auth.users(id) on delete set null;

with latest as (
  select distinct on (m.thread_id)
    m.thread_id,
    m.body,
    m.sender_user_id,
    m.created_at
  from public.messages m
  order by m.thread_id, m.created_at desc, m.id desc
)
update public.message_threads mt
set
  last_message_body = latest.body,
  last_sender_user_id = latest.sender_user_id,
  last_message_at = latest.created_at,
  updated_at = greatest(mt.updated_at, latest.created_at)
from latest
where latest.thread_id = mt.id;;
