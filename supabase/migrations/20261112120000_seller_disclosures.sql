-- Seller legal notices are owned by the creator, not by PARARI.
-- Private drafts are never readable through the Data API.
create table if not exists public.seller_disclosures (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  seller_type text not null default 'individual' check (seller_type in ('individual','company')),
  legal_name text not null default '',
  representative_name text not null default '',
  postal_code text not null default '',
  address text not null default '',
  phone text not null default '',
  contact_email text not null default '',
  delivery_terms text not null default '',
  return_terms text not null default '',
  payment_terms text not null default '',
  privacy_policy text not null default '',
  published boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.seller_disclosures enable row level security;
revoke all on public.seller_disclosures from anon, authenticated;
-- Read and write only through authenticated server-side endpoints using
-- the service role, with explicit auth.uid ownership checks at the API boundary.
comment on table public.seller_disclosures is
  'Seller-authored statutory disclosure and privacy text, published only after explicit confirmation.';
