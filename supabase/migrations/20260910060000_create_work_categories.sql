-- PARARI CATEGORY 1.0
-- 作品カテゴリー本体 + 作品との多対多対応

create table public.parari_work_categories (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null
    references auth.users(id)
    on delete cascade,

  name text not null,
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint parari_work_categories_name_length_check
    check (
      char_length(btrim(name)) >= 1
      and char_length(btrim(name)) <= 80
    )
);

create unique index
  parari_work_categories_owner_name_unique_idx
on public.parari_work_categories (
  owner,
  lower(btrim(name))
);

create index
  parari_work_categories_owner_sort_idx
on public.parari_work_categories (
  owner,
  sort_order,
  name
);


create table public.parari_work_category_links (
  work_id uuid not null
    references public.parari_books(id)
    on delete cascade,

  category_id uuid not null
    references public.parari_work_categories(id)
    on delete cascade,

  owner uuid not null
    references auth.users(id)
    on delete cascade,

  created_at timestamptz not null default now(),

  primary key (work_id, category_id)
);

create index
  parari_work_category_links_owner_idx
on public.parari_work_category_links (
  owner,
  work_id
);

create index
  parari_work_category_links_category_idx
on public.parari_work_category_links (
  category_id,
  work_id
);


alter table public.parari_work_categories
  enable row level security;

alter table public.parari_work_category_links
  enable row level security;


create policy parari_work_categories_select_own
on public.parari_work_categories
for select
to authenticated
using (
  owner = auth.uid()
);

create policy parari_work_categories_insert_own
on public.parari_work_categories
for insert
to authenticated
with check (
  owner = auth.uid()
);

create policy parari_work_categories_update_own
on public.parari_work_categories
for update
to authenticated
using (
  owner = auth.uid()
)
with check (
  owner = auth.uid()
);

create policy parari_work_categories_delete_own
on public.parari_work_categories
for delete
to authenticated
using (
  owner = auth.uid()
);


create policy parari_work_category_links_select_own
on public.parari_work_category_links
for select
to authenticated
using (
  owner = auth.uid()
);

create policy parari_work_category_links_insert_own
on public.parari_work_category_links
for insert
to authenticated
with check (
  owner = auth.uid()

  and exists (
    select 1
    from public.parari_work_categories c
    where c.id = category_id
      and c.owner = auth.uid()
  )

  and exists (
    select 1
    from public.parari_books b
    where b.id = work_id
      and b.owner = auth.uid()
      and coalesce(b.is_deleted, false) = false
  )
);

create policy parari_work_category_links_delete_own
on public.parari_work_category_links
for delete
to authenticated
using (
  owner = auth.uid()
);


grant select, insert, update, delete
on public.parari_work_categories
to authenticated;

grant select, insert, delete
on public.parari_work_category_links
to authenticated;


comment on table public.parari_work_categories is
  'User-defined categories for organizing PARARI works.';

comment on table public.parari_work_category_links is
  'Many-to-many relation between PARARI works and owner categories.';
