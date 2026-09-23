-- PARARI five-tier plan compatibility and FREE image quota
-- 2026-09-23

begin;

-- Existing work-limit guard treated unknown paid plans as FREE.
-- Keep Organizer and Host on the current paid creation limits.
do $migration$
declare
  v_oid regprocedure;
  v_definition text;
  v_patched text;
begin
  v_oid := to_regprocedure('public.parari_enforce_plan_limits()');

  if v_oid is null then
    raise exception 'public.parari_enforce_plan_limits() is missing';
  end if;

  select pg_get_functiondef(v_oid)
  into v_definition;

  v_patched := replace(
    v_definition,
    'v_plan = ''plus''',
    'v_plan in (''plus'', ''organizer'', ''host'')'
  );

  if v_patched = v_definition then
    raise exception
      'Could not patch parari_enforce_plan_limits(): expected Plus branch was not found';
  end if;

  execute v_patched;
end;
$migration$;

-- Storage uploads still go through the Storage API. This function is used
-- only by its INSERT RLS policy to calculate the authenticated owner's total.
create or replace function public.parari_can_upload_image(
  p_name text,
  p_metadata jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_is_monitor boolean := false;
  v_plan text := 'free';
  v_billing_status text := 'none';
  v_new_size bigint := 0;
  v_used_size bigint := 0;
  v_free_limit constant bigint := 104857600; -- 100 MiB
begin
  if v_user_id is null then
    return false;
  end if;

  if p_name not like v_user_id::text || '/%' then
    return false;
  end if;

  v_new_size := coalesce(
    nullif(p_metadata ->> 'size', '')::bigint,
    0
  );

  -- Missing or invalid size metadata must never turn into an unlimited upload.
  if v_new_size <= 0 then
    return false;
  end if;

  select coalesce(p.is_monitor, false)
  into v_is_monitor
  from public.profiles p
  where p.user_id = v_user_id;

  if v_is_monitor then
    return true;
  end if;

  select
    coalesce(ub.plan, 'free'),
    coalesce(ub.billing_status, 'none')
  into
    v_plan,
    v_billing_status
  from public.user_billing ub
  where ub.user_id = v_user_id;

  if
    v_plan in ('plus', 'organizer', 'host', 'pro')
    and v_billing_status in ('active', 'trialing')
  then
    return true;
  end if;

  select coalesce(
    sum(
      coalesce(
        nullif(o.metadata ->> 'size', '')::bigint,
        0
      )
    ),
    0
  )
  into v_used_size
  from storage.objects o
  where o.bucket_id = 'parari-images'
    and o.name like v_user_id::text || '/%'
    -- On overwrite, replace the existing object's size instead of adding twice.
    and o.name <> p_name;

  return v_used_size + v_new_size <= v_free_limit;
exception
  when invalid_text_representation then
    return false;
end;
$function$;

comment on function public.parari_can_upload_image(text, jsonb)
is 'RLS helper: FREE users may store at most 100 MiB in parari-images.';

revoke all
on function public.parari_can_upload_image(text, jsonb)
from public;

grant execute
on function public.parari_can_upload_image(text, jsonb)
to authenticated;

drop policy if exists "auth_insert 1jrbylq_0"
on storage.objects;

drop policy if exists "parari_images_auth_insert_own_prefix"
on storage.objects;

drop policy if exists "parari_images_owner_insert"
on storage.objects;

create policy "parari_images_insert_with_plan_quota"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'parari-images'
  and name like (select auth.uid())::text || '/%'
  and public.parari_can_upload_image(name, metadata)
);

drop policy if exists "parari_images_auth_update_own"
on storage.objects;

drop policy if exists "parari_images_owner_update"
on storage.objects;

create policy "parari_images_update_with_plan_quota"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'parari-images'
  and name like (select auth.uid())::text || '/%'
)
with check (
  bucket_id = 'parari-images'
  and name like (select auth.uid())::text || '/%'
  and public.parari_can_upload_image(name, metadata)
);

commit;
