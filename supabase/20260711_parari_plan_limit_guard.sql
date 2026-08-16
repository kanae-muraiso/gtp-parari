-- PARARI Free / Plus limit database guard
-- 2026-07-11
--
-- Free
--   works: 10
--   published works: 3
--   pages per work: 10
--
-- Plus
--   works: 100
--   published works: 100
--   pages per work: 100
--
-- service_roleはアプリ側APIで判定済みのため、このTriggerでは除外する。
-- authenticatedユーザーによる旧画面・直接DB更新を最終防衛する。

begin;

-- ============================================================
-- PAGE / PAGEINFO数の集計
-- ============================================================

create or replace function public.parari_count_page_panels(
  p_content text
)
returns integer
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $function$
  select count(*)::integer
  from regexp_split_to_table(
    replace(coalesce(p_content, ''), E'\r\n', E'\n'),
    E'\n'
  ) as source(line)
  where source.line ~*
    '^[[:space:]]*\[(PAGE|PAGEINFO)(:[^]]+)?\]([[:space:]]|$)';
$function$;

comment on function public.parari_count_page_panels(text)
is 'Counts PAGE and PAGEINFO panel headers in PARARI SSOT.';

-- ============================================================
-- Free / Plusの最終防衛Trigger
-- ============================================================

create or replace function public.parari_enforce_plan_limits()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_request_role text;

  v_plan text := 'free';
  v_billing_status text := 'none';

  v_work_limit integer := 10;
  v_published_work_limit integer := 3;
  v_page_limit integer := 10;

  v_current_work_count integer := 0;
  v_current_published_count integer := 0;

  v_old_page_count integer := 0;
  v_new_page_count integer := 0;

  v_old_active boolean := false;
  v_new_active boolean := false;

  v_old_public boolean := false;
  v_new_public boolean := false;
begin
  -- Supabase JWTのroleを取得する。
  v_request_role := auth.role();

  -- 新しいサーバーAPI、Webhook、APPLICATION内部処理は
  -- service_roleを利用するため、アプリ側の詳細判定に任せる。
  if v_request_role = 'service_role' then
    return new;
  end if;

  -- SQL Editorや管理処理も除外する。
  if current_user in (
    'postgres',
    'supabase_admin'
  ) then
    return new;
  end if;

  -- 同一ユーザーによる同時作成・同時公開の競合を防ぐ。
  perform pg_advisory_xact_lock(
    hashtextextended(new.owner::text, 0)
  );

  select
    ub.plan,
    ub.billing_status
  into
    v_plan,
    v_billing_status
  from public.user_billing ub
  where ub.user_id = new.owner;

  if not found then
    v_plan := 'free';
    v_billing_status := 'none';
  end if;

  -- active / trialingだけを有料プランとして扱う。
  if
    v_plan = 'plus'
    and v_billing_status in ('active', 'trialing')
  then
    v_work_limit := 100;
    v_published_work_limit := 100;
    v_page_limit := 100;

  elsif
    v_plan = 'pro'
    and v_billing_status in ('active', 'trialing')
  then
    -- Proは将来用。現状は無制限として扱う。
    v_work_limit := null;
    v_published_work_limit := null;
    v_page_limit := null;

  else
    v_plan := 'free';
    v_work_limit := 10;
    v_published_work_limit := 3;
    v_page_limit := 10;
  end if;

  -- ==========================================================
  -- ページ数制限
  --
  -- 既存作品が上限超過済みでも、
  -- ページを増やさない編集・ページ削除は許可する。
  -- ==========================================================

  v_new_page_count :=
    public.parari_count_page_panels(new.content);

  if tg_op = 'UPDATE' then
    v_old_page_count :=
      public.parari_count_page_panels(old.content);
  else
    v_old_page_count := 0;
  end if;

  if
    v_page_limit is not null
    and v_new_page_count > v_page_limit
    and (
      tg_op = 'INSERT'
      or v_new_page_count > v_old_page_count
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'PARARI_PAGE_LIMIT_REACHED',
      detail = format(
        '%s plan allows %s pages per work. Requested: %s.',
        v_plan,
        v_page_limit,
        v_new_page_count
      ),
      hint = case
        when v_plan = 'free'
          then 'Freeプランは1作品10ページまでです。Plusをご利用ください。'
        else
          'Plusプランは1作品100ページまでです。'
      end;
  end if;

  -- ==========================================================
  -- 作品作成数制限
  --
  -- INSERTと、削除済み作品を元に戻すUPDATEを判定する。
  -- ==========================================================

  v_new_active := coalesce(new.is_deleted, false) = false;

  if tg_op = 'UPDATE' then
    v_old_active := coalesce(old.is_deleted, false) = false;
  else
    v_old_active := false;
  end if;

  if
    v_work_limit is not null
    and v_new_active
    and (
      tg_op = 'INSERT'
      or not v_old_active
      or new.owner is distinct from old.owner
    )
  then
    select count(*)::integer
    into v_current_work_count
    from public.parari_books pb
    where pb.owner = new.owner
      and coalesce(pb.is_deleted, false) = false;

    if v_current_work_count >= v_work_limit then
      raise exception using
        errcode = 'P0001',
        message = 'PARARI_WORK_LIMIT_REACHED',
        detail = format(
          '%s plan allows %s works. Current: %s.',
          v_plan,
          v_work_limit,
          v_current_work_count
        ),
        hint = case
          when v_plan = 'free'
            then 'Freeプランは10作品までです。Plusをご利用ください。'
          else
            'Plusプランは100作品までです。'
        end;
    end if;
  end if;

  -- ==========================================================
  -- 公開作品数制限
  --
  -- visibility=public または is_public=true を公開扱いとする。
  -- 既に公開済みの作品を編集保存する場合は加算しない。
  -- ==========================================================

  v_new_public :=
    v_new_active
    and (
      new.visibility = 'public'
      or coalesce(new.is_public, false) = true
    );

  if tg_op = 'UPDATE' then
    v_old_public :=
      v_old_active
      and (
        old.visibility = 'public'
        or coalesce(old.is_public, false) = true
      );
  else
    v_old_public := false;
  end if;

  if
    v_published_work_limit is not null
    and v_new_public
    and not v_old_public
  then
    select count(*)::integer
    into v_current_published_count
    from public.parari_books pb
    where pb.owner = new.owner
      and coalesce(pb.is_deleted, false) = false
      and (
        pb.visibility = 'public'
        or coalesce(pb.is_public, false) = true
      );

    if
      v_current_published_count >=
      v_published_work_limit
    then
      raise exception using
        errcode = 'P0001',
        message = 'PARARI_PUBLISHED_WORK_LIMIT_REACHED',
        detail = format(
          '%s plan allows %s published works. Current: %s.',
          v_plan,
          v_published_work_limit,
          v_current_published_count
        ),
        hint = case
          when v_plan = 'free'
            then 'Freeプランは3作品まで公開できます。別の作品を非公開にするか、Plusをご利用ください。'
          else
            'Plusプランは100作品まで公開できます。'
        end;
    end if;
  end if;

  return new;
end;
$function$;

comment on function public.parari_enforce_plan_limits()
is 'Final database guard for PARARI work, published-work and page limits.';

drop trigger if exists
  trg_parari_books_plan_limits
on public.parari_books;

create trigger trg_parari_books_plan_limits
before insert or update
on public.parari_books
for each row
execute function public.parari_enforce_plan_limits();

-- ============================================================
-- 制限判定用Index
-- ============================================================

create index if not exists
  parari_books_owner_active_idx
on public.parari_books (owner)
where coalesce(is_deleted, false) = false;

create index if not exists
  parari_books_owner_active_public_idx
on public.parari_books (owner)
where
  coalesce(is_deleted, false) = false
  and (
    visibility = 'public'
    or coalesce(is_public, false) = true
  );

commit;

-- ============================================================
-- 作成結果確認
-- ============================================================

select jsonb_pretty(
  jsonb_build_object(
    'trigger', (
      select coalesce(
        jsonb_agg(to_jsonb(x)),
        '[]'::jsonb
      )
      from (
        select
          trigger_name,
          event_manipulation,
          action_timing,
          action_statement
        from information_schema.triggers
        where event_object_schema = 'public'
          and event_object_table = 'parari_books'
          and trigger_name =
            'trg_parari_books_plan_limits'
        order by event_manipulation
      ) x
    ),

    'functions', (
      select coalesce(
        jsonb_agg(to_jsonb(x)),
        '[]'::jsonb
      )
      from (
        select
          p.proname as function_name,
          pg_get_function_arguments(p.oid) as arguments
        from pg_proc p
        join pg_namespace n
          on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in (
            'parari_count_page_panels',
            'parari_enforce_plan_limits'
          )
        order by p.proname
      ) x
    ),

    'indexes', (
      select coalesce(
        jsonb_agg(to_jsonb(x)),
        '[]'::jsonb
      )
      from (
        select
          indexname,
          indexdef
        from pg_indexes
        where schemaname = 'public'
          and tablename = 'parari_books'
          and indexname in (
            'parari_books_owner_active_idx',
            'parari_books_owner_active_public_idx'
          )
        order by indexname
      ) x
    )
  )
) as installation_result;
