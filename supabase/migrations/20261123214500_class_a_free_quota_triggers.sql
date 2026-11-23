-- CLASS A safety limits enforced at the database boundary, including RPC and direct service calls.
-- Free: one class across owned businesses; up to 10 active enrollments per business.
-- Monitor and active explicit CLASS B businesses are exempt. Existing rows are not modified.
-- These trigger functions cannot be invoked directly by anon/authenticated clients.

create or replace function public.class_a_guard_new_class()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_monitor boolean;
  v_b boolean;
  v_count integer;
begin
  select owner_user_id into v_owner from public.class_schools where id = new.school_id;
  if v_owner is null then raise exception 'Unknown CLASS business' using errcode = 'P0002'; end if;
  select coalesce(is_monitor,false) into v_monitor from public.profiles where user_id = v_owner;
  select exists (
    select 1 from public.class_feature_plans p
    where p.school_id = new.school_id and p.plan = 'b'
      and (p.active_until is null or p.active_until > now())
  ) into v_b;
  if coalesce(v_monitor,false) or v_b then return new; end if;

  -- Serialize different businesses of the same owner.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text, 110719));
  select count(*) into v_count
  from public.school_classes c join public.class_schools s on s.id = c.school_id
  where s.owner_user_id = v_owner;
  if v_count > 1 then
    raise exception 'CLASS A supports one class' using errcode = 'P0010';
  end if;
  return new;
end;
$$;

drop trigger if exists class_a_limit_new_class on public.school_classes;
create trigger class_a_limit_new_class
  after insert or update of school_id on public.school_classes
  for each row execute function public.class_a_guard_new_class();

create or replace function public.class_a_guard_active_enrollment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_monitor boolean;
  v_b boolean;
  v_count integer;
begin
  if new.status <> 'active' then return new; end if;
  select owner_user_id into v_owner from public.class_schools where id = new.school_id;
  if v_owner is null then raise exception 'Unknown CLASS business' using errcode = 'P0002'; end if;
  select coalesce(is_monitor,false) into v_monitor from public.profiles where user_id = v_owner;
  select exists (
    select 1 from public.class_feature_plans p
    where p.school_id = new.school_id and p.plan = 'b'
      and (p.active_until is null or p.active_until > now())
  ) into v_b;
  if coalesce(v_monitor,false) or v_b then return new; end if;
  perform 1 from public.class_schools where id = new.school_id for update;
  select count(*) into v_count from public.school_enrollments
    where school_id = new.school_id and status = 'active';
  if v_count > 10 then
    raise exception 'CLASS A supports ten active students' using errcode = 'P0011';
  end if;
  return new;
end;
$$;

drop trigger if exists class_a_limit_active_enrollment on public.school_enrollments;
create trigger class_a_limit_active_enrollment
  after insert or update of status,school_id on public.school_enrollments
  for each row execute function public.class_a_guard_active_enrollment();

revoke all on function public.class_a_guard_new_class() from public, anon, authenticated;
revoke all on function public.class_a_guard_active_enrollment() from public, anon, authenticated;
