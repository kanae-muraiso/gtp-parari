create table public.application_messages (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.application_entries(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint application_messages_body_not_blank
    check (char_length(btrim(body)) between 1 and 2000)
);

create index application_messages_entry_created_idx
  on public.application_messages(entry_id, created_at, id);

alter table public.application_messages enable row level security;

comment on table public.application_messages is
  'One-to-one messages between an APPLICATION owner and the applicant for a specific application entry.';

comment on column public.application_messages.entry_id is
  'Conversation scope. Recipient is derived from application_entries.user_id and applications.owner_user_id.';;
