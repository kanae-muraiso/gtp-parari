alter table public.class_schools add column business_type text not null default 'school'
  check(business_type in ('school','studio','other'));
-- Keep owner lookups indexed after lifting the one-business limit.
create index class_schools_owner_idx on public.class_schools(owner_user_id,tier);
alter table public.class_schools drop constraint class_schools_owner_user_id_tier_key;

alter table public.school_classes add column fee_override_yen integer check(fee_override_yen between 0 and 1000000);
alter table public.school_enrollments add column contract_fee_yen integer check(contract_fee_yen between 0 and 1000000);
alter table public.school_class_visit_reservations
  add column surcharge_yen integer not null default 0 check(surcharge_yen between 0 and 1000000),
  add column surcharge_paid_at timestamptz;
grant update(surcharge_paid_at) on public.school_class_visit_reservations to service_role;
create table public.school_class_surcharge_receipts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.class_schools(id) on delete cascade,
  enrollment_id uuid not null,
  class_id uuid not null,
  visit_on date not null,
  amount_yen integer not null check(amount_yen>0),
  paid_at timestamptz not null,
  foreign key(school_id,enrollment_id) references public.school_enrollments(school_id,id),
  foreign key(school_id,class_id) references public.school_classes(school_id,id)
);
alter table public.school_class_surcharge_receipts enable row level security;
revoke all on public.school_class_surcharge_receipts from public,anon,authenticated;
grant select,insert on public.school_class_surcharge_receipts to service_role;

create function public.class_visit_surcharge(p_school uuid,p_member uuid,p_class uuid,p_makeup uuid)
returns integer language sql stable set search_path='' as $$
  select greatest(0,coalesce(c.fee_override_yen,(plan.value->>'monthlyFee')::integer,0) -
    coalesce(e.contract_fee_yen,source.fee_override_yen,(plan.value->>'monthlyFee')::integer,0))
  from public.school_classes c
  join public.school_enrollments e on e.school_id=c.school_id and e.id=p_member
  left join public.school_class_makeups credit on credit.id=p_makeup and credit.enrollment_id=e.id and credit.school_id=c.school_id
  left join public.school_classes source on source.id=credit.source_class_id and source.school_id=c.school_id
  cross join lateral (select public.class_product_for_slot(p_school,p_class) as value) plan
  where c.school_id=p_school and c.id=p_class;
$$;
revoke all on function public.class_visit_surcharge(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.class_visit_surcharge(uuid,uuid,uuid,uuid) to service_role;

create function public.set_class_visit_surcharge()
returns trigger language plpgsql set search_path='' as $$
begin
  new.surcharge_yen := coalesce(public.class_visit_surcharge(new.school_id,new.enrollment_id,new.class_id,new.makeup_id),0);
  return new;
end;
$$;
revoke all on function public.set_class_visit_surcharge() from public,anon,authenticated;
grant execute on function public.set_class_visit_surcharge() to service_role;
create trigger price_class_visit before insert on public.school_class_visit_reservations
  for each row execute function public.set_class_visit_surcharge();

create function public.reserve_priced_class_visit(p_user uuid,p_school uuid,p_class uuid,p_day date,p_makeup uuid,p_expected integer)
returns void language plpgsql set search_path='' as $$
declare
  quote integer;
begin
  if p_makeup is null then
    perform public.manage_class_visit(p_user,p_school,p_class,p_day,false);
  else
    perform public.reserve_school_class_makeup(p_user,p_school,p_class,p_day,p_makeup);
  end if;
  select r.surcharge_yen into strict quote from public.school_class_visit_reservations r join public.school_enrollments e on e.id=r.enrollment_id
    where r.school_id=p_school and r.class_id=p_class and r.visit_on=p_day and e.user_id=p_user;
  if quote is distinct from p_expected then raise exception 'class price changed' using errcode='P0003'; end if;
end;
$$;
revoke all on function public.reserve_priced_class_visit(uuid,uuid,uuid,date,uuid,integer) from public,anon,authenticated;
grant execute on function public.reserve_priced_class_visit(uuid,uuid,uuid,date,uuid,integer) to service_role;

create function public.confirm_class_visit_surcharge(p_owner uuid,p_school uuid,p_member uuid,p_class uuid,p_day date)
returns void language plpgsql set search_path='' as $$
declare
  reservation public.school_class_visit_reservations%rowtype;
  paid timestamptz := now();
begin
  if not exists(select 1 from public.class_schools where id=p_school and owner_user_id=p_owner) then raise no_data_found; end if;
  select * into strict reservation from public.school_class_visit_reservations
    where school_id=p_school and enrollment_id=p_member and class_id=p_class and visit_on=p_day for update;
  if reservation.surcharge_yen<=0 then raise invalid_parameter_value; end if;
  if reservation.surcharge_paid_at is not null then return; end if;
  update public.school_class_visit_reservations set surcharge_paid_at=paid
    where enrollment_id=p_member and class_id=p_class and visit_on=p_day;
  insert into public.school_class_surcharge_receipts(school_id,enrollment_id,class_id,visit_on,amount_yen,paid_at)
    values(p_school,p_member,p_class,p_day,reservation.surcharge_yen,paid);
end;
$$;
revoke all on function public.confirm_class_visit_surcharge(uuid,uuid,uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.confirm_class_visit_surcharge(uuid,uuid,uuid,uuid,date) to service_role;

create function public.save_school_priced_slot(
  p_owner uuid,p_school uuid,p_class uuid,p_new boolean,p_school_name text,p_class_name text,
  p_starts_on date,p_starts_at time,p_cadence text,p_location text,p_delivery text,p_meeting_url text,p_duration integer,p_product uuid,p_fee integer
) returns uuid language plpgsql set search_path='' as $$
begin
  if p_product is not null and (not p_new or not exists(select 1 from public.school_class_products
    where id=p_product and school_id=p_school)) then raise invalid_parameter_value; end if;
  perform public.save_school_class(p_owner,p_school,p_class,p_new,p_school_name,p_class_name,
    p_starts_on,p_starts_at,p_cadence,p_location,p_delivery,p_meeting_url,p_duration);
  if p_product is not null then
    update public.school_classes set product_id=p_product where id=p_class and school_id=p_school and product_id is null;
  end if;
  update public.school_classes set fee_override_yen=p_fee where id=p_class;
  return p_class;
end;
$$;

revoke all on function public.save_school_priced_slot(uuid,uuid,uuid,boolean,text,text,date,time,text,text,text,text,integer,uuid,integer) from public,anon,authenticated;
grant execute on function public.save_school_priced_slot(uuid,uuid,uuid,boolean,text,text,date,time,text,text,text,text,integer,uuid,integer) to service_role;

create or replace function public.finish_class_admission(p_owner uuid, p_school uuid, p_case uuid)
returns void language plpgsql set search_path = '' as $$
declare
  candidate public.school_admission_cases%rowtype;
  current_terms text;
  member_user uuid;
  member_id uuid;
  existed boolean;
  product jsonb;
  eligible uuid[];
begin
  perform 1 from public.class_schools where id=p_school and owner_user_id=p_owner for update;
  if not found then raise no_data_found; end if;
  select c.* into strict candidate from public.school_admission_cases c
  join public.class_schools s on s.id = c.school_id
  where c.id = p_case and c.school_id = p_school and s.owner_user_id = p_owner for update of c;
  if candidate.enrollment_id is not null then return; end if;
  select terms into current_terms from public.school_admission_settings where school_id = p_school;
  if candidate.decision <> 'approved' or candidate.briefing not in ('skip', 'done') or candidate.test not in ('skip', 'graded')
     or candidate.starts_on is null or candidate.consent_at is null or candidate.agreed_terms is distinct from coalesce(current_terms, '')
     or (candidate.deadline is not null and candidate.deadline < (now() at time zone 'Asia/Tokyo')::date)
     or (candidate.payment = 'advance' and candidate.received_at is null)
     or (candidate.briefing_followup is not null and
       (candidate.applicant_user_id is null or candidate.application_fields is null)) then
    raise exception 'admission requirements incomplete' using errcode = '22023';
  end if;
  if candidate.briefing_followup #>> '{design,audience}' = 'adult' then
    member_user := candidate.applicant_user_id;
  end if;
  select exists(select 1 from public.school_enrollments where school_id=p_school and
    (id=candidate.id or (member_user is not null and user_id=member_user))) into existed;
  perform public.add_class_a_member(p_owner, p_school, candidate.id, candidate.name, member_user);
  if member_user is null then
    member_id := candidate.id;
  else
    select id into strict member_id from public.school_enrollments where school_id = p_school and user_id = member_user;
  end if;
  if candidate.requested_class_id is not null then
    if not existed then
      product := public.class_product_for_slot(p_school,candidate.requested_class_id);
      if product->>'booking'='flexible' and (product->'classIds') ? candidate.requested_class_id::text then
        select array_agg(c.id order by c.id) into eligible from public.school_classes c
          where c.school_id=p_school and (product->'classIds') ? c.id::text;
        perform public.set_school_member_classes(p_owner,p_school,member_id,eligible,'flexible');
      else
        perform public.set_school_member_classes(p_owner,p_school,member_id,array[candidate.requested_class_id],'fixed');
      end if;
    else
      if exists(select 1 from public.school_class_assignments a join public.school_classes old on old.id=a.class_id
        join public.school_classes target on target.id=candidate.requested_class_id
        where a.school_id=p_school and a.enrollment_id=member_id and old.product_id is distinct from target.product_id)
      then raise invalid_parameter_value; end if;
      insert into public.school_class_assignments(school_id,enrollment_id,class_id)
        values(p_school,member_id,candidate.requested_class_id) on conflict do nothing;
      update public.school_enrollments set class_participation='multiple'
        where id=member_id and class_participation='fixed'
        and (select count(*) from public.school_class_assignments where school_id=p_school and enrollment_id=member_id)>1;
    end if;
  end if;
  if not existed and candidate.requested_class_id is not null then
    update public.school_enrollments e set contract_fee_yen=coalesce(c.fee_override_yen,
      (public.class_product_for_slot(p_school,c.id)->>'monthlyFee')::integer,0)
      from public.school_classes c where e.id=member_id and c.id=candidate.requested_class_id;
  end if;
  update public.school_admission_cases set enrollment_id = member_id, revision = revision + 1
  where id = candidate.id;
end;
$$;

create or replace function public.add_school_slot_member(p_owner uuid,p_school uuid,p_member uuid,p_name text,p_user uuid,p_class uuid)
returns void language plpgsql set search_path='' as $$
declare
  existing uuid;
  target uuid;
begin
  perform 1 from public.class_schools where id=p_school and owner_user_id=p_owner for update;
  if not found then raise no_data_found; end if;
  select product_id into target from public.school_classes where school_id=p_school and id=p_class;
  if not found then raise no_data_found; end if;
  select id into existing from public.school_enrollments where school_id=p_school and (id=p_member or (p_user is not null and user_id=p_user));
  if existing is not null then
    if exists(select 1 from public.school_class_assignments a join public.school_classes c on c.id=a.class_id
      where a.enrollment_id=existing and c.product_id is distinct from target) then raise invalid_parameter_value; end if;
    update public.school_enrollments set status='active' where id=existing;
    insert into public.school_class_assignments(school_id,enrollment_id,class_id)
      values(p_school,existing,p_class) on conflict do nothing;
    update public.school_enrollments set class_participation='multiple' where id=existing and class_participation='fixed'
      and (select count(*) from public.school_class_assignments where enrollment_id=existing)>1;
    return;
  end if;
  insert into public.school_enrollments(id,school_id,name,user_id,contract_fee_yen)
    select p_member,p_school,p_name,p_user,coalesce(c.fee_override_yen,(public.class_product_for_slot(p_school,p_class)->>'monthlyFee')::integer,0)
    from public.school_classes c where c.id=p_class and c.school_id=p_school;
  insert into public.school_class_assignments(school_id,enrollment_id,class_id) values(p_school,p_member,p_class);
end;
$$;

create function public.move_unassigned_school_slot(p_owner uuid,p_source uuid,p_destination uuid,p_class uuid)
returns void language plpgsql set search_path='' as $$
declare
  slot public.school_classes%rowtype;
begin
  if p_source=p_destination then raise invalid_parameter_value; end if;
  perform 1 from public.class_schools where owner_user_id=p_owner and id in (p_source,p_destination) order by id for update;
  if (select count(*) from public.class_schools where owner_user_id=p_owner and id in (p_source,p_destination))<>2 then raise no_data_found; end if;
  perform 1 from public.school_recruitment where school_id in (p_source,p_destination) order by school_id for update;
  select * into strict slot from public.school_classes where id=p_class and school_id=p_source for update;
  if slot.product_id is not null or exists(select 1 from public.school_class_assignments where class_id=p_class)
    or exists(select 1 from public.school_class_visit_reservations where class_id=p_class)
    or exists(select 1 from public.school_admission_cases where requested_class_id=p_class)
    or exists(select 1 from public.school_recruitment_offers where school_id=p_source and p_class=any(class_ids))
    or exists(select 1 from public.school_admission_applications where class_id=p_class)
    or exists(select 1 from public.school_class_product_designs where school_id=p_source and (design->'classIds') ? p_class::text)
  then raise invalid_parameter_value; end if;
  update public.school_classes set school_id=p_destination where id=p_class;
end;
$$;
revoke all on function public.move_unassigned_school_slot(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.move_unassigned_school_slot(uuid,uuid,uuid,uuid) to service_role;
