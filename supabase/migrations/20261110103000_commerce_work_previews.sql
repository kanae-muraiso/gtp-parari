begin;

alter table public.commerce_products
  add column listing_visibility text check (listing_visibility in ('public', 'unlisted')),
  add column preview_page_count integer not null default 1 check (preview_page_count between 1 and 200);

-- Existing products keep their previous purchase pages until the seller enables a sample.
-- Direct purchase pages use a server lookup, so link-only products cannot be enumerated.
drop policy "public_select_active_commerce_products" on public.commerce_products;
create policy "public_select_active_commerce_products" on public.commerce_products
  for select to anon, authenticated
  using (active and (product_type <> 'work' or listing_visibility is null or listing_visibility = 'public'));

create policy "buyers_select_purchased_product" on public.commerce_products
  for select to authenticated
  using (exists (
    select 1 from public.commerce_purchases p
    where p.product_id = commerce_products.id and p.buyer_user_id = (select auth.uid())
  ));

create function public.protect_commerce_work_body() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.product_type = 'work' and new.active then
    update public.parari_books
      set visibility = 'private', is_public = false
      where id = new.work_id and owner = new.owner_user_id and is_deleted is distinct from true;
    if not found then
      raise exception 'Invalid work for sale';
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_commerce_work_body
  before insert or update of active, work_id, owner_user_id, product_type on public.commerce_products
  for each row execute function public.protect_commerce_work_body();

create function public.prevent_public_commerce_body() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (new.is_public is true or new.visibility in ('public', 'unlisted')) and exists (
    select 1 from public.commerce_products p
    where p.work_id = new.id and p.product_type = 'work' and p.active
  ) then
    raise exception 'An active sale requires a private work body';
  end if;
  return new;
end;
$$;

-- All work updates must see link-only products, including updates made by editors.
alter function public.prevent_public_commerce_body() security definer;
revoke all on function public.prevent_public_commerce_body() from public, anon, authenticated;
create trigger prevent_public_commerce_body
  before update of visibility, is_public on public.parari_books
  for each row execute function public.prevent_public_commerce_body();

commit;
