-- LIBRARY v2 additive foundation. Existing shelf, commerce, APPLICATION and membership tables remain unchanged.
create table if not exists public.parari_author_follows (
 follower_user_id uuid not null references auth.users(id) on delete cascade,
 author_user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (follower_user_id, author_user_id),
 constraint parari_author_follows_no_self check (follower_user_id <> author_user_id)
);
create index if not exists parari_author_follows_author_idx on public.parari_author_follows(author_user_id);
alter table public.parari_author_follows enable row level security;
create policy "follows_select_own" on public.parari_author_follows for select to authenticated using ((select auth.uid()) = follower_user_id);
create policy "follows_insert_own" on public.parari_author_follows for insert to authenticated with check ((select auth.uid()) = follower_user_id);
create policy "follows_delete_own" on public.parari_author_follows for delete to authenticated using ((select auth.uid()) = follower_user_id);

create table if not exists public.parari_work_stars (
 user_id uuid not null references auth.users(id) on delete cascade,
 work_id uuid not null references public.parari_books(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (user_id, work_id)
);
create index if not exists parari_work_stars_work_idx on public.parari_work_stars(work_id);
alter table public.parari_work_stars enable row level security;
create policy "stars_select_own" on public.parari_work_stars for select to authenticated using ((select auth.uid()) = user_id);
create policy "stars_insert_own" on public.parari_work_stars for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.parari_books b where b.id = work_id and b.is_deleted is distinct from true and (b.owner = (select auth.uid()) or b.visibility = 'public')));
create policy "stars_delete_own" on public.parari_work_stars for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.parari_reading_states (
 user_id uuid not null references auth.users(id) on delete cascade,
 work_id uuid not null references public.parari_books(id) on delete cascade,
 state text not null check (state in ('to_read','reading','read')),
 updated_at timestamptz not null default now(),
 primary key (user_id, work_id)
);
alter table public.parari_reading_states enable row level security;
create policy "reading_select_own" on public.parari_reading_states for select to authenticated using ((select auth.uid()) = user_id);
create policy "reading_insert_own" on public.parari_reading_states for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.parari_books b where b.id = work_id and b.is_deleted is distinct from true and (b.owner = (select auth.uid()) or b.visibility = 'public')));
create policy "reading_update_own" on public.parari_reading_states for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "reading_delete_own" on public.parari_reading_states for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.parari_library_categories (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 80),
 sort_order integer not null default 0,
 created_at timestamptz not null default now(),
 unique (user_id, name),
 unique (id, user_id)
);
alter table public.parari_library_categories enable row level security;
create policy "categories_select_own" on public.parari_library_categories for select to authenticated using ((select auth.uid()) = user_id);
create policy "categories_insert_own" on public.parari_library_categories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "categories_update_own" on public.parari_library_categories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "categories_delete_own" on public.parari_library_categories for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.parari_library_category_items (
 category_id uuid not null,
 user_id uuid not null,
 target_kind text not null check (target_kind in ('author','work')),
 target_id uuid not null,
 created_at timestamptz not null default now(),
 primary key (category_id, target_kind, target_id),
 foreign key (category_id,user_id) references public.parari_library_categories(id,user_id) on delete cascade
);
create index if not exists parari_library_category_items_user_idx on public.parari_library_category_items(user_id);
alter table public.parari_library_category_items enable row level security;
create policy "category_items_select_own" on public.parari_library_category_items for select to authenticated using ((select auth.uid()) = user_id);
create policy "category_items_insert_own" on public.parari_library_category_items for insert to authenticated with check ((select auth.uid()) = user_id and ( (target_kind = 'author' and exists (select 1 from public.profiles p where p.user_id = target_id)) or (target_kind = 'work' and exists (select 1 from public.parari_books b where b.id = target_id and b.is_deleted is distinct from true and (b.owner = (select auth.uid()) or b.visibility = 'public')))));
create policy "category_items_delete_own" on public.parari_library_category_items for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.profiles add column if not exists author_directory_opt_in boolean not null default false;
alter table public.profiles add column if not exists introduction_work_id uuid references public.parari_books(id) on delete set null;

grant select,insert,delete on public.parari_author_follows to authenticated;
grant select,insert,delete on public.parari_work_stars to authenticated;
grant select,insert,update,delete on public.parari_reading_states to authenticated;
grant select,insert,update,delete on public.parari_library_categories to authenticated;
grant select,insert,delete on public.parari_library_category_items to authenticated;
