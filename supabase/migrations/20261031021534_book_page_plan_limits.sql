-- 2026-10-31 JST — PART: BOOK quota, reference PAGE count and bounded draft pool.
-- No work data is rewritten. Apply alongside the API release, not to production previews.
create or replace function public.parari_is_book(source text)
returns boolean language sql immutable parallel safe set search_path = public, pg_temp
as $$ select coalesce(source,'') ~* '^\s*\[(BOOK|BOOKINFO)\M'; $$;

create or replace function public.parari_page_ref_ids(source text)
returns setof text language sql immutable parallel safe set search_path = public, pg_temp
as $$ select m[1] from regexp_matches(coalesce(source,''), '^\s*\[PAGE_REF\s+id=([^\]\s]+)\]\s*$', 'gim') m; $$;

create or replace function public.parari_count_page_panels(p_content text)
returns integer language sql immutable parallel safe set search_path = public, pg_temp
as $$ select case when refs > 0 then refs else greatest(1, pages) end
from (select (select count(*)::int from public.parari_page_ref_ids(p_content)) refs,
(select count(*)::int from regexp_matches(coalesce(p_content,''),'^\s*\[(PAGE|PAGEINFO)(:[^]]+)?\](\s|$)','gim')) pages) counts; $$;

-- Defense for legacy direct-client saves. The service API uses parseBlocks-based text counts.
create or replace function public.parari_max_page_text_chars(source text)
returns integer language sql immutable parallel safe set search_path = public, pg_temp
as $fn$
select coalesce(max(char_length(regexp_replace(
 regexp_replace(regexp_replace(part, '^\s*\[[A-Z_]+[^\]\n]*\][^\n]*$', '', 'gm'),
 '^\s*(title|subtitle|url|src|href|id|mainImage|coverImage|authoringSet|visibility|workType|originPageId|originBookId|width|height|align):[^\n]*$', '', 'gim'),
 '[[:space:]]', '', 'g'))),0)::int
from regexp_split_to_table(coalesce(source,''), E'\\n(?=\\s*\\[(PAGE|PAGEINFO)(:|\\]))') part;
$fn$;

create or replace function public.parari_enforce_plan_limits()
returns trigger language plpgsql set search_path = public, pg_temp
as $$
declare
  plan_name text := 'free'; status_name text;
  book_cap int := 3; page_cap int := 20; work_cap int := 10; public_cap int := 3;
  char_cap int := 20000;
  count_books int; count_works int; count_public int; count_pages int;
  is_service boolean := coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb->>'role' = 'service_role';
  old_active boolean := false; old_public boolean := false; old_book boolean := false;
  new_public boolean; new_book boolean;
begin
  if current_user in ('postgres','supabase_admin') then return new; end if;
  if exists(select 1 from public.profiles where user_id=new.owner and is_monitor=true) then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.owner::text,0));
  select plan,billing_status into plan_name,status_name from public.user_billing where user_id=new.owner;
  if plan_name in ('plus','organizer','host') and status_name in ('active','trialing') then
    book_cap:=100; page_cap:=100; work_cap:=100; public_cap:=100; char_cap:=50000;
  elsif plan_name='pro' and status_name in ('active','trialing') then return new;
  end if;
  if tg_op='UPDATE' then
    old_active := not coalesce(old.is_deleted,false);
    old_public := old_active and (old.visibility='public' or coalesce(old.is_public,false));
    old_book := public.parari_is_book(old.content);
  end if;
  if coalesce(new.is_deleted,false) then return new; end if;
  new_book := public.parari_is_book(new.content);
  new_public := new.visibility='public' or coalesce(new.is_public,false);
  if public.parari_count_page_panels(new.content)>page_cap and
     (tg_op='INSERT' or public.parari_count_page_panels(new.content)>public.parari_count_page_panels(old.content)) then
    raise exception using message='PARARI_PAGE_LIMIT_REACHED', hint=format('1 BOOKは%s PAGEまでです。元の作品は保持されています。',page_cap);
  end if;
  if not coalesce(is_service,false) and public.parari_max_page_text_chars(new.content)>char_cap and
     (tg_op='INSERT' or public.parari_max_page_text_chars(new.content)>public.parari_max_page_text_chars(old.content)) then
    raise exception using message='PARARI_PAGE_CHARACTER_LIMIT_REACHED',hint=format('1 PAGEは%s字までです。分割してください。',char_cap);
  end if;
  if new_book and (not old_book or not old_active or (tg_op='UPDATE' and new.owner is distinct from old.owner)) then
    select count(*) into count_books from public.parari_books w
    where w.owner=new.owner and not coalesce(w.is_deleted,false) and w.id<>new.id and public.parari_is_book(w.content);
    if count_books>=book_cap then raise exception using message='PARARI_BOOK_LIMIT_REACHED',hint=format('BOOKは%s冊までです。',book_cap); end if;
  end if;
  if not new_book and new.content !~* '^\s*\[(WEB|WEBINFO)\M' and
     (not old_active or (tg_op='UPDATE' and new.owner is distinct from old.owner)) then
    select count(*) into count_pages from public.parari_books w where w.owner=new.owner and w.id<>new.id and not coalesce(w.is_deleted,false)
      and not public.parari_is_book(w.content) and coalesce(w.content,'') !~* '^\s*\[(WEB|WEBINFO)\M';
    if count_pages>=book_cap*page_cap+work_cap then raise exception using message='PARARI_PAGE_POOL_LIMIT_REACHED',hint='保存できるPAGE総数に達しました。不要な単独PAGEを整理してください。'; end if;
  end if;
  -- The authenticated API checks standalone creation context. Keep direct-client checks too.
  if not coalesce(is_service,false) and not new_book and not old_active then
    select count(*) into count_works from public.parari_books w where w.owner=new.owner and w.id<>new.id and not coalesce(w.is_deleted,false) and not public.parari_is_book(w.content)
      and not exists(select 1 from public.parari_books b cross join lateral public.parari_page_ref_ids(b.content) ref(id)
        where b.owner=new.owner and not coalesce(b.is_deleted,false) and public.parari_is_book(b.content) and ref.id=w.id::text);
    if count_works>=work_cap then raise exception using message='PARARI_WORK_LIMIT_REACHED',hint='単独PAGE・WEBの作成上限に達しました。'; end if;
  end if;
  if new_public and not old_public and (new_book or not exists(select 1 from public.parari_books b cross join lateral public.parari_page_ref_ids(b.content) ref(id)
    where b.owner=new.owner and not coalesce(b.is_deleted,false) and public.parari_is_book(b.content) and ref.id=new.id::text)) then
    select count(*) into count_public from public.parari_books w where w.owner=new.owner and w.id<>new.id and not coalesce(w.is_deleted,false)
      and (w.visibility='public' or coalesce(w.is_public,false))
      and (public.parari_is_book(w.content) or not exists(select 1 from public.parari_books b cross join lateral public.parari_page_ref_ids(b.content) ref(id)
        where b.owner=new.owner and not coalesce(b.is_deleted,false) and public.parari_is_book(b.content) and ref.id=w.id::text));
    if count_public>=public_cap then raise exception using message='PARARI_PUBLISHED_WORK_LIMIT_REACHED',hint='公開作品数の上限に達しました。'; end if;
  end if;
  return new;
end; $$;
-- Trigger already exists; replacing its function preserves the attachment.
