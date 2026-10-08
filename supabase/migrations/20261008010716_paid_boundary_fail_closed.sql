-- 2026-10-08 JST / PART: A damaged reserved boundary must never expose paid source
begin;
alter policy paid_source_no_anonymous on public.parari_books using (
 coalesce(content,'') !~* '\[PAYWALL'
);
alter policy paid_source_author_only on public.parari_books using (
 coalesce(content,'') !~* '\[PAYWALL'
 or owner=(select auth.uid())
 or exists(select 1 from public.parari_work_collaborators c where c.work_id=parari_books.id and c.user_id=(select auth.uid()) and c.role='editor')
);
-- Public catalog retains paid titles/URLs without returning their content.
-- Explicit public visibility is checked inside the definer view; no private rows.
create or replace view public.parari_public_works with (security_barrier=true) as
 select id,owner,title,
 case when coalesce(content,'') ~* '\[PAYWALL' then null else content end as content,
 is_public,created_at,updated_at,is_deleted,visibility,slug,stable_slug,custom_slug,expires_at,
 show_in_profile_works,profile_works_order,render_mode,physical_pagination,entry_mode,published_at
 from public.parari_books where is_deleted is not true and visibility in ('public','unlisted');
commit;
