-- PARARI DB security inspection as one JSON result
-- データ変更は行いません。

select jsonb_pretty(
  jsonb_build_object(

    'rls', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
      from (
        select
          n.nspname as schema_name,
          c.relname as table_name,
          c.relrowsecurity as rls_enabled,
          c.relforcerowsecurity as force_rls
        from pg_class c
        join pg_namespace n
          on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname in ('parari_books', 'user_billing')
        order by c.relname
      ) x
    ),

    'columns', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
      from (
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
          and table_name in ('parari_books', 'user_billing')
        order by table_name, ordinal_position
      ) x
    ),

    'policies', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
      from (
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
          and tablename in ('parari_books', 'user_billing')
        order by tablename, cmd, policyname
      ) x
    ),

    'triggers', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
      from (
        select
          event_object_table,
          trigger_name,
          event_manipulation,
          action_timing,
          action_orientation,
          action_statement
        from information_schema.triggers
        where event_object_schema = 'public'
          and event_object_table in ('parari_books', 'user_billing')
        order by event_object_table, trigger_name, event_manipulation
      ) x
    ),

    'constraints', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
      from (
        select
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
          and c.relname in ('parari_books', 'user_billing')
        order by c.relname, con.conname
      ) x
    ),

    'indexes', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
      from (
        select
          tablename,
          indexname,
          indexdef
        from pg_indexes
        where schemaname = 'public'
          and tablename in ('parari_books', 'user_billing')
        order by tablename, indexname
      ) x
    )

  )
) as inspection_result;
