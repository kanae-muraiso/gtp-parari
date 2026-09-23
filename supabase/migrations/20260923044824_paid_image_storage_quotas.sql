-- Enforce the agreed image storage quota for every PARARI plan.
-- FREE 100 MiB / PLUS 1 GiB / ORGANIZER 5 GiB / HOST 20 GiB / PRO 50 GiB

begin;

create or replace function private.parari_can_upload_image(
  p_name text,
  p_metadata jsonb
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, storage, pg_temp
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_is_monitor boolean := false;
  v_plan text := 'free';
  v_billing_status text := 'none';
  v_new_size bigint := 0;
  v_used_size bigint := 0;
  v_limit bigint := 104857600; -- FREE: 100 MiB
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

  -- Missing, invalid, or empty size metadata must never bypass the quota.
  if v_new_size <= 0 then
    return false;
  end if;

  select coalesce(p.is_monitor, false)
  into v_is_monitor
  from public.profiles p
  where p.user_id = v_user_id;

  -- Monitors need unrestricted storage while testing every plan feature.
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

  -- Inactive paid subscriptions fall back to the FREE quota.
  if v_billing_status in ('active', 'trialing') then
    v_limit := case v_plan
      when 'plus' then 1073741824       -- 1 GiB
      when 'organizer' then 5368709120  -- 5 GiB
      when 'host' then 21474836480      -- 20 GiB
      when 'pro' then 53687091200       -- 50 GiB
      else v_limit
    end;
  end if;

  -- Serialize quota checks for the same user so concurrent uploads cannot
  -- both pass using the same pre-upload total.
  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text, 0)
  );

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

  return v_used_size + v_new_size <= v_limit;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return false;
end;
$function$;

comment on function private.parari_can_upload_image(text, jsonb)
is 'RLS helper: image quota is FREE 100 MiB, PLUS 1 GiB, ORGANIZER 5 GiB, HOST 20 GiB, and PRO 50 GiB; monitors are exempt.';

grant usage on schema private to authenticated;

revoke all
on function private.parari_can_upload_image(text, jsonb)
from public;

revoke all
on function private.parari_can_upload_image(text, jsonb)
from anon;

grant execute
on function private.parari_can_upload_image(text, jsonb)
to authenticated;

drop policy if exists "parari_images_insert_with_plan_quota"
on storage.objects;

create policy "parari_images_insert_with_plan_quota"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'parari-images'
  and name like (select auth.uid())::text || '/%'
  and private.parari_can_upload_image(name, metadata)
);

drop policy if exists "parari_images_update_with_plan_quota"
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
  and private.parari_can_upload_image(name, metadata)
);

-- The helper is policy-internal and should not remain exposed as a public RPC.
drop function public.parari_can_upload_image(text, jsonb);

commit;
