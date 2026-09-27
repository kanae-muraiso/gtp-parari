-- Square connection + APPLICATION payments foundation
-- Prepared on feature branch only. Do not apply to production until sandbox verification.

begin;

create table if not exists public.square_connections (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  merchant_id text not null unique,
  location_id text not null,
  access_token_enc text not null,
  refresh_token_enc text,
  token_expires_at timestamptz,
  status text not null default 'active'
    check (status in ('active','revoked','error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.square_connections enable row level security;

create table if not exists public.square_oauth_states (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  state_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.square_oauth_states enable row level security;

create index if not exists square_oauth_states_owner_expiry_idx
  on public.square_oauth_states(owner_user_id, expires_at);

create table if not exists public.application_payments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null unique
    references public.application_entries(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'square'
    check (provider = 'square'),
  status text not null default 'created'
    check (status in (
      'created','pending','paid','failed','cancelled',
      'refund_pending','refunded'
    )),
  amount numeric not null check (amount > 0),
  currency text not null,
  merchant_id text not null,
  location_id text not null,
  provider_order_id text unique,
  provider_payment_link_id text unique,
  provider_payment_id text unique,
  checkout_url text,
  idempotency_key text not null unique,
  completed_at timestamptz,
  refunded_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.application_payments enable row level security;

create index if not exists application_payments_owner_idx
  on public.application_payments(owner_user_id, created_at desc);

create table if not exists public.square_webhook_events (
  event_id text primary key,
  event_type text not null,
  merchant_id text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.square_webhook_events enable row level security;

-- Server-only helper: payment success updates the APPLICATION entry atomically.
create or replace function public.complete_application_square_payment(
  p_order_id text,
  p_payment_id text,
  p_amount numeric,
  p_currency text
)
returns table (
  entry_id uuid,
  entry_status text,
  was_expired boolean
)
language plpgsql
set search_path = ''
as $function$
declare
  v_payment public.application_payments%rowtype;
  v_entry public.application_entries%rowtype;
  v_expired boolean := false;
begin
  select *
  into v_payment
  from public.application_payments ap
  where ap.provider_order_id = p_order_id
  for update;

  if not found then
    raise exception 'application_payment_not_found'
      using errcode = 'P0002';
  end if;

  if v_payment.amount is distinct from p_amount
     or upper(v_payment.currency) is distinct from upper(p_currency) then
    raise exception 'application_payment_amount_mismatch'
      using errcode = '22023';
  end if;

  select *
  into v_entry
  from public.application_entries ae
  where ae.id = v_payment.entry_id
  for update;

  if not found then
    raise exception 'application_entry_not_found'
      using errcode = 'P0002';
  end if;

  v_expired :=
    v_entry.status = 'expired'
    or (
      v_entry.payment_hold_expires_at is not null
      and v_entry.payment_hold_expires_at <= now()
      and v_entry.payment_status = 'unpaid'
    );

  update public.application_payments
  set
    provider_payment_id = p_payment_id,
    status = case when v_expired then 'refund_pending' else 'paid' end,
    completed_at = now(),
    updated_at = now()
  where id = v_payment.id;

  if not v_expired then
    update public.application_entries
    set
      payment_status = 'paid',
      payment_confirmed_at = now(),
      payment_hold_expires_at = null,
      status = case
        when qualification_status in ('not_required','approved')
          then 'confirmed'
        else status
      end,
      updated_at = now()
    where id = v_entry.id
    returning * into v_entry;
  else
    if v_entry.status <> 'expired' then
      update public.application_entries
      set
        status = 'expired',
        expired_at = coalesce(expired_at, now()),
        updated_at = now()
      where id = v_entry.id
      returning * into v_entry;
    end if;
  end if;

  return query
  select v_entry.id, v_entry.status, v_expired;
end;
$function$;

revoke all on function public.complete_application_square_payment(
  text, text, numeric, text
) from public, anon, authenticated;
grant execute on function public.complete_application_square_payment(
  text, text, numeric, text
) to service_role;

commit;
