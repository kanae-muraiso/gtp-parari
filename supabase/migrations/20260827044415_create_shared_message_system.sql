create table if not exists public.message_threads (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references auth.users(id) on delete cascade,
  user_b_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz null,
  constraint message_threads_distinct_users check (user_a_id <> user_b_id),
  constraint message_threads_canonical_order check (user_a_id::text < user_b_id::text),
  constraint message_threads_unique_pair unique (user_a_id, user_b_id)
);

create table if not exists public.message_thread_contexts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  context_type text not null,
  context_id uuid not null,
  relationship_type text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  ended_at timestamptz null,
  constraint message_thread_contexts_type_check check (
    context_type in ('application', 'calendar', 'membership', 'collaboration')
  ),
  constraint message_thread_contexts_status_check check (
    status in ('active', 'ended')
  ),
  constraint message_thread_contexts_unique_source unique (
    thread_id, context_type, context_id
  )
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_body_length check (
    char_length(btrim(body)) between 1 and 2000
  )
);

create index if not exists message_threads_user_a_idx
  on public.message_threads(user_a_id, last_message_at desc nulls last);
create index if not exists message_threads_user_b_idx
  on public.message_threads(user_b_id, last_message_at desc nulls last);
create index if not exists message_thread_contexts_thread_status_idx
  on public.message_thread_contexts(thread_id, status);
create index if not exists message_thread_contexts_source_idx
  on public.message_thread_contexts(context_type, context_id);
create index if not exists messages_thread_created_idx
  on public.messages(thread_id, created_at, id);

alter table public.message_threads enable row level security;
alter table public.message_thread_contexts enable row level security;
alter table public.messages enable row level security;

-- Move the current APPLICATION-message prototype data into the shared system.
-- Keep application_messages intact until the new path is verified in the app.
insert into public.message_threads (
  user_a_id,
  user_b_id,
  created_at,
  updated_at,
  last_message_at
)
select distinct
  case
    when a.owner_user_id::text < ae.user_id::text then a.owner_user_id
    else ae.user_id
  end as user_a_id,
  case
    when a.owner_user_id::text < ae.user_id::text then ae.user_id
    else a.owner_user_id
  end as user_b_id,
  min(am.created_at) over (
    partition by
      case when a.owner_user_id::text < ae.user_id::text then a.owner_user_id else ae.user_id end,
      case when a.owner_user_id::text < ae.user_id::text then ae.user_id else a.owner_user_id end
  ) as created_at,
  max(am.created_at) over (
    partition by
      case when a.owner_user_id::text < ae.user_id::text then a.owner_user_id else ae.user_id end,
      case when a.owner_user_id::text < ae.user_id::text then ae.user_id else a.owner_user_id end
  ) as updated_at,
  max(am.created_at) over (
    partition by
      case when a.owner_user_id::text < ae.user_id::text then a.owner_user_id else ae.user_id end,
      case when a.owner_user_id::text < ae.user_id::text then ae.user_id else a.owner_user_id end
  ) as last_message_at
from public.application_messages am
join public.application_entries ae on ae.id = am.entry_id
join public.applications a on a.id = ae.application_id
where ae.user_id is not null
  and a.owner_user_id <> ae.user_id
on conflict (user_a_id, user_b_id) do update
set last_message_at = greatest(
      coalesce(public.message_threads.last_message_at, excluded.last_message_at),
      excluded.last_message_at
    ),
    updated_at = greatest(public.message_threads.updated_at, excluded.updated_at);

insert into public.message_thread_contexts (
  thread_id,
  context_type,
  context_id,
  relationship_type,
  status,
  created_at
)
select distinct
  mt.id,
  'application',
  ae.id,
  'application_owner_applicant',
  'active',
  ae.created_at
from public.application_messages am
join public.application_entries ae on ae.id = am.entry_id
join public.applications a on a.id = ae.application_id
join public.message_threads mt
  on mt.user_a_id = case
       when a.owner_user_id::text < ae.user_id::text then a.owner_user_id
       else ae.user_id
     end
 and mt.user_b_id = case
       when a.owner_user_id::text < ae.user_id::text then ae.user_id
       else a.owner_user_id
     end
where ae.user_id is not null
on conflict (thread_id, context_type, context_id) do nothing;

insert into public.messages (
  id,
  thread_id,
  sender_user_id,
  body,
  created_at
)
select
  am.id,
  mt.id,
  am.sender_user_id,
  am.body,
  am.created_at
from public.application_messages am
join public.application_entries ae on ae.id = am.entry_id
join public.applications a on a.id = ae.application_id
join public.message_threads mt
  on mt.user_a_id = case
       when a.owner_user_id::text < ae.user_id::text then a.owner_user_id
       else ae.user_id
     end
 and mt.user_b_id = case
       when a.owner_user_id::text < ae.user_id::text then ae.user_id
       else a.owner_user_id
     end
where ae.user_id is not null
on conflict (id) do nothing;;
