-- CLASS B production billing migration. Reviewed 2026-11-28.
-- Existing CLASS A limits and monitor access are retained.
-- Square-funded class exemptions require a separately verified billing linkage.
begin;
alter table public.class_feature_plans
  add column if not exists class_blocks integer not null default 1
  check (class_blocks >= 1 and class_blocks <= 1000000);

create or replace function public.class_a_guard_new_class()
returns trigger language plpgsql security definer set search_path to ''
as $function$
declare
  v_owner uuid;
  v_monitor boolean;
  v_blocks integer;
  v_count bigint;
begin
  select owner_user_id into v_owner from public.class_schools where id = new.school_id;
  if v_owner is null then raise exception 'Unknown CLASS business' using errcode = 'P0002'; end if;
  select coalesce(is_monitor,false) into v_monitor from public.profiles where user_id = v_owner;
  if coalesce(v_monitor,false) then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text, 110719));
  select p.class_blocks into v_blocks from public.class_feature_plans p
  where p.school_id = new.school_id and p.plan = 'b'
    and (p.active_until is null or p.active_until > now());
  if v_blocks is not null then
    select count(*) into v_count from public.school_classes where school_id = new.school_id;
    if v_count > 5::bigint * v_blocks then
      raise exception 'CLASS B class allowance exceeded' using errcode = 'P0012';
    end if;
  else
    select count(*) into v_count from public.school_classes c
      join public.class_schools s on s.id = c.school_id where s.owner_user_id = v_owner;
    if v_count > 1 then
      raise exception 'CLASS A supports one class' using errcode = 'P0010';
    end if;
  end if;
  return new;
end;
$function$;
revoke execute on function public.class_a_guard_new_class() from public, anon, authenticated;
commit;
