-- PARARI plan limits: database security inspection
-- 2026-07-11
--
-- データ変更は一切行わない確認専用SQLです。

-- ============================================================
-- 1. RLSの有効状態
-- ============================================================

select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n
  on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'parari_books',
    'user_billing'
  )
order by c.relname;

-- ============================================================
-- 2. 関係カラムの型・NULL・デフォルト値
-- ============================================================

select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'parari_books',
    'user_billing'
  )
order by table_name, ordinal_position;

-- ============================================================
-- 3. 現在のRLS Policy
-- ============================================================

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'parari_books',
    'user_billing'
  )
order by tablename, cmd, policyname;

-- ============================================================
-- 4. 現在のTrigger
-- ============================================================

select
  event_object_schema,
  event_object_table,
  trigger_name,
  event_manipulation,
  action_timing,
  action_orientation,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in (
    'parari_books',
    'user_billing'
  )
order by event_object_table, trigger_name, event_manipulation;

-- ============================================================
-- 5. Constraint
-- ============================================================

select
  n.nspname as schema_name,
  c.relname as table_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class c
  on c.oid = con.conrelid
join pg_namespace n
  on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'parari_books',
    'user_billing'
  )
order by c.relname, con.conname;

-- ============================================================
-- 6. Index
-- ============================================================

select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'parari_books',
    'user_billing'
  )
order by tablename, indexname;
