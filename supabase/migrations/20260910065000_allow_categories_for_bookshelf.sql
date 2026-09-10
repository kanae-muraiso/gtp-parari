-- PARARI CATEGORY 1.1
-- 同じ個人カテゴリーを
-- ・自分の作品
-- ・自分の本棚に保存した他人の作品
-- の両方で利用できるようにする。

drop policy if exists
  parari_work_category_links_insert_own
on public.parari_work_category_links;

create policy parari_work_category_links_insert_own
on public.parari_work_category_links
for insert
to authenticated
with check (
  owner = auth.uid()

  -- カテゴリーそのものは自分のカテゴリーであること
  and exists (
    select 1
    from public.parari_work_categories c
    where c.id = category_id
      and c.owner = auth.uid()
  )

  -- 対象作品は、
  -- ① 自分の作品
  -- ② 新しい本棚 user_shelves / user_shelf_items に入っている作品
  -- ③ 旧 user_bookshelf に保存されている作品
  -- のいずれか
  and (
    exists (
      select 1
      from public.parari_books b
      where b.id = work_id
        and b.owner = auth.uid()
        and coalesce(b.is_deleted, false) = false
    )

    or exists (
      select 1
      from public.user_shelf_items si
      join public.user_shelves s
        on s.id = si.shelf_id
      where si.book_id = work_id
        and s.user_id = auth.uid()
    )

    or exists (
      select 1
      from public.user_bookshelf ub
      where ub.book_id = work_id
        and ub.user_id = auth.uid()
    )
  )
);

comment on table public.parari_work_categories is
  'User-owned categories shared across owned works and saved bookshelf works.';

comment on table public.parari_work_category_links is
  'Personal category assignments for owned or bookshelf PARARI works.';
