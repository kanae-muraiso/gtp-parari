-- Draft: apply after class-b-class-blocks-draft.sql and class-b-operation-quotas-draft.sql.
-- The mapping is an internal activation record, written only after the CLASS
-- recurring checkout flow has been implemented and verified (STEP 6).
-- A Square connection, generic product or external link alone is never sufficient.
begin;
create table public.class_b_square_products (
  school_id uuid not null,
  class_product_id uuid not null,
  commerce_product_id uuid not null unique references public.commerce_products(id) on delete restrict,
  environment text not null check(environment in ('production','sandbox')),
  verified_at timestamptz not null default now(),
  primary key(school_id,class_product_id),
  foreign key(school_id,class_product_id) references public.school_class_products(school_id,id) on delete cascade
);
alter table public.class_b_square_products enable row level security;
revoke all on public.class_b_square_products from public,anon,authenticated;
grant select,insert,update,delete on public.class_b_square_products to service_role;

create function public.class_b_square_slot(p_school uuid,p_class uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(
  select 1 from public.school_classes c
  join public.school_class_products cp on cp.school_id=c.school_id and cp.id=c.product_id
  join public.class_b_square_products l on l.school_id=c.school_id and l.class_product_id=cp.id
  join public.class_schools s on s.id=c.school_id
  join public.commerce_products p on p.id=l.commerce_product_id and p.owner_user_id=s.owner_user_id
  join public.square_connections sq on sq.owner_user_id=s.owner_user_id and sq.environment=l.environment
  where c.school_id=p_school and c.id=p_class and s.archived_at is null
    and l.environment='production' and sq.status='active'
    and p.active and p.billing_interval='monthly' and p.product_type in ('recurring','service')
    and p.currency='JPY' and p.amount>0
    and nullif(btrim(p.square_plan_id),'') is not null
    and nullif(btrim(p.square_plan_variation_id),'') is not null
    and (case when jsonb_typeof(cp.design->'monthlyFee')='number' then (cp.design->>'monthlyFee')::numeric else null end)=p.amount
    and (c.fee_override_yen is null or c.fee_override_yen=p.amount)
 );
$$;
revoke all on function public.class_b_square_slot(uuid,uuid) from public,anon,authenticated;
grant execute on function public.class_b_square_slot(uuid,uuid) to service_role;

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
    -- CLASS B uses the deferred slot quota, so the priced-slot RPC can attach the product in the same transaction.
    return new;
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
-- Check final state at transaction end. Existing save_school_priced_slot first
-- inserts the slot then attaches product_id; immediate checking would reject it.
create function public.class_b_guard_slot_quota() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_owner uuid; v_monitor boolean; v_blocks integer; v_school uuid; v_count bigint;
begin
 select school_id into v_school from public.school_classes where id=new.id;
 if not found then return new; end if;
 select s.owner_user_id,coalesce(p.is_monitor,false) into v_owner,v_monitor
   from public.class_schools s left join public.profiles p on p.user_id=s.owner_user_id where s.id=v_school;
 if v_owner is null or v_monitor then return new; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text,110719));
 select class_blocks into v_blocks from public.class_feature_plans
  where school_id=v_school and plan='b' and (active_until is null or active_until>now());
 if v_blocks is null then return new; end if;
 if public.class_b_square_slot(v_school,new.id) then return new; end if;
 select count(*) into v_count from public.school_classes c where c.school_id=v_school
  and not public.class_b_square_slot(v_school,c.id);
 if v_count>5::bigint*v_blocks then raise exception 'CLASS B ordinary class allowance exceeded' using errcode='P0012'; end if;
 return new;
end; $$;
create constraint trigger class_b_slot_quota after insert or update of school_id,product_id,fee_override_yen
 on public.school_classes deferrable initially deferred for each row execute function public.class_b_guard_slot_quota();
revoke all on function public.class_b_guard_slot_quota() from public,anon,authenticated;
create or replace function public.class_b_assert_fixed_seats(p_school uuid,p_class uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if not public.class_b_enforce_capacity(p_school) or public.class_b_square_slot(p_school,p_class) then return; end if;
 perform 1 from public.class_schools where id=p_school for no key update;
 if (select count(*) from public.school_class_assignments a join public.school_enrollments e
      on e.id=a.enrollment_id and e.school_id=a.school_id
      where a.school_id=p_school and a.class_id=p_class and e.status='active'
      and (a.self_selected or e.class_participation<>'flexible'))>30 then
   raise exception 'CLASS B fixed seat allowance exceeded' using errcode='P0013';
 end if;
 -- A new fixed seat must not make an existing future flexible booking overfull.
 if exists(select 1 from public.school_class_visit_reservations r
    where r.school_id=p_school and r.class_id=p_class and r.visit_on>=(now() at time zone 'Asia/Tokyo')::date
    group by r.visit_on having count(*)+public.class_fixed_seat_count_on(p_school,p_class,r.visit_on)>30) then
   raise exception 'CLASS B lesson capacity exceeded' using errcode='P0013';
 end if;
end; $$;
create or replace function public.class_b_guard_visit() returns trigger language plpgsql set search_path='' as $$
begin
 if not public.class_b_enforce_capacity(new.school_id) or public.class_b_square_slot(new.school_id,new.class_id) then return new; end if;
 perform 1 from public.class_schools where id=new.school_id for no key update;
 if public.class_fixed_seat_count_on(new.school_id,new.class_id,new.visit_on)+
   (select count(*) from public.school_class_visit_reservations
     where school_id=new.school_id and class_id=new.class_id and visit_on=new.visit_on)>30 then
   raise exception 'CLASS B lesson capacity exceeded' using errcode='P0013';
 end if;
 return new;
end; $$;
-- Revocation never deletes existing classes or members. Such slots revert to
-- ordinary counting; subsequent additions are checked against the allowance.
commit;
