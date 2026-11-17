alter table public.school_class_assignments
  add column self_selected boolean not null default false;

create function public.class_fixed_seat_count(p_school uuid, p_class uuid)
returns integer language sql stable set search_path='' as $$
  select count(*)::integer from public.school_class_assignments a
    join public.school_enrollments e on e.id=a.enrollment_id
  where a.school_id=p_school and a.class_id=p_class and e.status='active'
    and (a.self_selected or e.class_participation<>'flexible');
$$;
revoke all on function public.class_fixed_seat_count(uuid,uuid) from public,anon,authenticated;
grant execute on function public.class_fixed_seat_count(uuid,uuid) to service_role;

create function public.choose_class_from_front(
  p_user uuid, p_school uuid, p_class uuid, p_day date, p_cancel boolean
) returns void language plpgsql set search_path='' as $$
declare
  member public.school_enrollments%rowtype;
  lesson public.school_classes%rowtype;
  plan jsonb;
  seats integer;
  today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  -- Serialize with teacher edits and the existing booking and makeup procedures.
  perform 1 from public.class_schools where id=p_school and archived_at is null for no key update;
  if not found then raise no_data_found; end if;
  select * into strict member from public.school_enrollments
    where school_id=p_school and user_id=p_user and status='active' for update;
  select * into strict lesson from public.school_classes where school_id=p_school and id=p_class for update;
  if lesson.product_id is null then raise invalid_parameter_value; end if;
  if not exists(select 1 from public.class_business_fronts f where f.school_id=p_school and
    ((f.published->'entries') ? ('product:' || lesson.product_id::text) or
     (f.published->'entries') ? ('schedule:' || lesson.product_id::text))) then raise no_data_found; end if;
  plan := public.class_product_for_slot(p_school,p_class);
  if plan is null or plan->>'walkInFee' is not null then raise invalid_parameter_value; end if;
  seats := public.class_fixed_seat_count(p_school,p_class);

  if p_day is null then
    if p_cancel or plan->>'booking' not in ('fixed','multiple') then raise invalid_parameter_value; end if;
    if exists(select 1 from public.school_class_assignments a
      where a.enrollment_id=member.id and a.class_id=p_class
        and (a.self_selected or member.class_participation<>'flexible')) then return; end if;
    if exists(select 1 from public.school_class_assignments a join public.school_classes c on c.id=a.class_id
      where a.enrollment_id=member.id and c.product_id=lesson.product_id
        and (a.self_selected or member.class_participation<>'flexible')) then
      raise exception 'class slot already chosen' using errcode='P0004';
    end if;
    if seats >= (plan->>'capacity')::integer or exists (
      select 1 from public.school_class_visit_reservations r
      where r.class_id=p_class and r.visit_on>=today
        and ((r.visit_on+lesson.starts_at) at time zone 'Asia/Tokyo')>now()
      group by r.visit_on having count(*)+seats >= (plan->>'capacity')::integer
    ) then raise exception 'class full' using errcode='P0001'; end if;
    insert into public.school_class_assignments(school_id,enrollment_id,class_id,self_selected)
      values(p_school,member.id,p_class,true)
      on conflict(school_id,enrollment_id,class_id) do update set self_selected=true;
    return;
  end if;

  if ((p_day+lesson.starts_at) at time zone 'Asia/Tokyo')<=now() then raise invalid_parameter_value; end if;
  if p_cancel then
    if exists(select 1 from public.school_class_visit_reservations where enrollment_id=member.id and class_id=p_class
      and visit_on=p_day and (makeup_id is not null or surcharge_paid_at is not null)) then raise invalid_parameter_value; end if;
    delete from public.school_class_visit_reservations where enrollment_id=member.id and class_id=p_class and visit_on=p_day;
    return;
  end if;
  if plan->>'booking'<>'flexible' or p_day>today+42 or
    not public.school_class_runs_on(lesson.id,lesson.starts_on,lesson.cadence,p_day) then raise invalid_parameter_value; end if;
  if exists(select 1 from public.school_class_visit_reservations where enrollment_id=member.id and class_id=p_class and visit_on=p_day) then return; end if;
  if exists(select 1 from public.school_class_visit_reservations r join public.school_classes c on c.id=r.class_id
    where r.enrollment_id=member.id and r.visit_on between p_day-1 and p_day+1
      and (r.visit_on+c.starts_at)<(p_day+lesson.starts_at)+make_interval(mins=>lesson.duration_minutes)
      and (r.visit_on+c.starts_at)+make_interval(mins=>c.duration_minutes)>(p_day+lesson.starts_at)) then
    raise exception 'overlapping visit' using errcode='P0005';
  end if;
  if seats + (select count(*) from public.school_class_visit_reservations where class_id=p_class and visit_on=p_day) >= (plan->>'capacity')::integer
    or (select count(*) from public.school_class_visit_reservations r join public.school_classes c on c.id=r.class_id
        where r.enrollment_id=member.id and c.product_id=lesson.product_id and r.makeup_id is null
          and r.visit_on>=date_trunc('month',p_day::timestamp)::date
          and r.visit_on<(date_trunc('month',p_day::timestamp)+interval '1 month')::date) >= (plan->>'monthlyVisits')::integer
  then raise exception 'class full or monthly allowance exceeded' using errcode='P0001'; end if;
  insert into public.school_class_visit_reservations(school_id,enrollment_id,class_id,visit_on)
    values(p_school,member.id,p_class,p_day) on conflict do nothing;
end;
$$;
revoke all on function public.choose_class_from_front(uuid,uuid,uuid,date,boolean) from public,anon,authenticated;
grant execute on function public.choose_class_from_front(uuid,uuid,uuid,date,boolean) to service_role;

create or replace function public.manage_class_visit(p_user uuid,p_school uuid,p_class uuid,p_day date,p_cancel boolean)
returns void language plpgsql set search_path='' as $$
declare
  member public.school_enrollments%rowtype;
  lesson public.school_classes%rowtype;
  plan jsonb;
  used integer;
  reserved integer;
begin
  perform 1 from public.class_schools where id=p_school and archived_at is null for share;
  if not found then raise no_data_found; end if;
  -- Serialize changes to a member's monthly allowance and to the class's capacity.
  select * into strict member from public.school_enrollments where school_id=p_school and user_id=p_user and status='active' for update;
  select * into strict lesson from public.school_classes where school_id=p_school and id=p_class for update;
  if ((p_day+lesson.starts_at) at time zone 'Asia/Tokyo')<=now() then raise invalid_parameter_value; end if;
  if p_cancel then
    delete from public.school_class_visit_reservations where enrollment_id=member.id and class_id=p_class and visit_on=p_day;
    return;
  end if;
  if member.class_participation<>'flexible' or exists(select 1 from public.school_class_assignments a
    where a.enrollment_id=member.id and a.class_id=p_class and a.self_selected)
    or not public.school_class_runs_on(lesson.id,lesson.starts_on,lesson.cadence,p_day) or
    p_day>(now() at time zone 'Asia/Tokyo')::date+42 or not exists(select 1 from public.school_class_assignments
      where school_id=p_school and class_id=p_class and enrollment_id=member.id) then raise invalid_parameter_value; end if;
  if exists(select 1 from public.school_class_visit_reservations where enrollment_id=member.id and class_id=p_class and visit_on=p_day) then return; end if;
  if exists(select 1 from public.school_class_visit_reservations r join public.school_classes c on c.id=r.class_id
    where r.enrollment_id=member.id and r.visit_on between p_day-1 and p_day+1
      and (r.visit_on+c.starts_at)<(p_day+lesson.starts_at)+make_interval(mins=>lesson.duration_minutes)
      and (r.visit_on+c.starts_at)+make_interval(mins=>c.duration_minutes)>(p_day+lesson.starts_at))
  then raise invalid_parameter_value; end if;
  plan := public.class_product_for_slot(p_school,p_class);
  if plan is null or not ((plan->'classIds') ? p_class::text) then raise invalid_parameter_value; end if;
  select count(*) into used from public.school_class_visit_reservations where enrollment_id=member.id
    and makeup_id is null
    and visit_on>=date_trunc('month',p_day::timestamp)::date and visit_on<(date_trunc('month',p_day::timestamp)+interval '1 month')::date;
  reserved := public.class_fixed_seat_count(p_school,p_class);
  reserved := reserved + (select count(*) from public.school_class_visit_reservations where class_id=p_class and visit_on=p_day);
  if used >= (plan->>'monthlyVisits')::integer or reserved >= (plan->>'capacity')::integer then
    raise exception 'class visit capacity exceeded' using errcode='P0001';
  end if;
  insert into public.school_class_visit_reservations(school_id,enrollment_id,class_id,visit_on)
    values(p_school,member.id,p_class,p_day) on conflict do nothing;
end;
$$;

create or replace function public.reserve_school_class_makeup(p_user uuid,p_school uuid,p_class uuid,p_day date,p_makeup uuid)
returns void language plpgsql set search_path='' as $$
declare
  member public.school_enrollments%rowtype;
  lesson public.school_classes%rowtype;
  credit public.school_class_makeups%rowtype;
  source_product uuid;
  plan jsonb;
  reserved integer;
begin
  perform 1 from public.class_schools where id=p_school and archived_at is null for share;
  if not found then raise no_data_found; end if;
  select * into strict member from public.school_enrollments where school_id=p_school and user_id=p_user and status='active' for update;
  select * into strict lesson from public.school_classes where school_id=p_school and id=p_class for update;
  select * into strict credit from public.school_class_makeups where school_id=p_school and enrollment_id=member.id and id=p_makeup;
  select product_id into source_product from public.school_classes where school_id=p_school and id=credit.source_class_id;
  plan := public.class_product_for_slot(p_school,p_class);
  if lesson.product_id is null or lesson.product_id is distinct from source_product or
    (member.class_participation='flexible' and not exists(select 1 from public.school_class_assignments a
      where a.enrollment_id=member.id and a.class_id=credit.source_class_id and a.self_selected)) or plan is null or (plan->>'makeup') not in ('approval','notice') or
    not public.school_class_runs_on(lesson.id,lesson.starts_on,lesson.cadence,p_day) or
    ((p_day+lesson.starts_at) at time zone 'Asia/Tokyo')<=now() or p_day>credit.expires_on or
    not exists(select 1 from public.school_class_assignments where enrollment_id=member.id and class_id=credit.source_class_id)
  then raise invalid_parameter_value; end if;
  if exists(select 1 from public.school_class_visit_reservations where makeup_id=p_makeup and class_id=p_class and visit_on=p_day) then return; end if;
  if exists(select 1 from public.school_class_assignments where enrollment_id=member.id and class_id=p_class) or
    exists(select 1 from public.school_class_visit_reservations where makeup_id=p_makeup or
      (enrollment_id=member.id and visit_on=p_day and class_id=p_class)) then raise invalid_parameter_value; end if;
  reserved := public.class_fixed_seat_count(p_school,p_class);
  reserved := reserved + (select count(*) from public.school_class_visit_reservations where class_id=p_class and visit_on=p_day);
  if reserved >= (plan->>'capacity')::integer then raise exception 'class full' using errcode='P0001'; end if;
  insert into public.school_class_visit_reservations(school_id,enrollment_id,class_id,visit_on,makeup_id)
    values(p_school,member.id,p_class,p_day,p_makeup);
end;
$$;

create or replace function public.grant_school_class_makeup(p_owner uuid,p_school uuid,p_member uuid,p_class uuid,p_day date)
returns void language plpgsql set search_path='' as $$
declare
  lesson public.school_classes%rowtype;
  plan jsonb;
  expires date;
begin
  perform 1 from public.school_enrollments e join public.class_schools s on s.id=e.school_id
    where e.id=p_member and e.school_id=p_school and e.status='active' and s.owner_user_id=p_owner and (e.class_participation<>'flexible' or exists(
      select 1 from public.school_class_assignments a where a.enrollment_id=e.id and a.class_id=p_class and a.self_selected))
    for update of e;
  if not found then raise no_data_found; end if;
  select c.* into strict lesson from public.school_classes c join public.school_class_assignments a on a.class_id=c.id
    where c.id=p_class and c.school_id=p_school and a.enrollment_id=p_member for update of c;
  plan := public.class_product_for_slot(p_school,p_class);
  if lesson.product_id is null or plan is null or (plan->>'makeup') not in ('approval','notice') or
    not public.school_class_runs_on(lesson.id,lesson.starts_on,lesson.cadence,p_day) or
    ((p_day+lesson.starts_at) at time zone 'Asia/Tokyo')>now() then raise invalid_parameter_value; end if;
  expires := (date_trunc('month',p_day::timestamp) +
    case when plan->>'makeupExpiry'='same_month' then interval '1 month' else interval '2 months' end - interval '1 day')::date;
  if expires < (now() at time zone 'Asia/Tokyo')::date then raise invalid_parameter_value; end if;
  insert into public.school_class_makeups(school_id,enrollment_id,source_class_id,missed_on,expires_on)
    values(p_school,p_member,p_class,p_day,expires) on conflict(enrollment_id,source_class_id,missed_on) do nothing;
end;
$$;

create or replace function public.set_school_member_classes(p_owner uuid,p_school uuid,p_member uuid,p_classes uuid[],p_mode text)
returns void language plpgsql set search_path='' as $$
declare
  selected_product uuid;
begin
  perform 1 from public.class_schools where id=p_school and owner_user_id=p_owner for update;
  if not found then raise no_data_found; end if;
  perform 1 from public.school_enrollments e join public.class_schools s on s.id=e.school_id
    where e.school_id=p_school and e.id=p_member and s.owner_user_id=p_owner for update of e;
  if not found then raise no_data_found; end if;
  if p_mode not in ('fixed','multiple','flexible') or coalesce(cardinality(p_classes),0)<1 or
    (p_mode='fixed' and cardinality(p_classes)<>1) or
    exists(select 1 from unnest(p_classes) c(id) where not exists(select 1 from public.school_classes sc where sc.school_id=p_school and sc.id=c.id))
  then raise invalid_parameter_value; end if;
  select product_id into selected_product from public.school_classes where id=p_classes[1] and school_id=p_school;
  if exists(select 1 from public.school_classes where school_id=p_school and id=any(p_classes)
    and product_id is distinct from selected_product) then raise invalid_parameter_value; end if;
  update public.school_enrollments set participation_mode='assigned', class_participation=p_mode where id=p_member;
  delete from public.school_class_assignments a using public.school_classes c
    where a.class_id=c.id and a.school_id=p_school and a.enrollment_id=p_member
      and not(a.class_id=any(p_classes)) and (not a.self_selected or c.product_id is not distinct from selected_product);
  if p_mode='flexible' then
    update public.school_class_assignments set self_selected=false
      where school_id=p_school and enrollment_id=p_member and class_id=any(p_classes) and self_selected;
  end if;
  insert into public.school_class_assignments(school_id,enrollment_id,class_id)
    select p_school,p_member,c from unnest(p_classes) c on conflict do nothing;
end;
$$;
