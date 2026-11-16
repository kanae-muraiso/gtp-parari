alter table public.class_schools add column archived_at timestamptz;

create function public.set_class_business_archived(p_owner uuid,p_school uuid,p_archived boolean)
returns void language plpgsql set search_path='' as $$
begin
  perform 1 from public.class_schools where id=p_school and owner_user_id=p_owner and tier='a' for update;
  if not found then raise no_data_found; end if;
  if p_archived then
    update public.school_recruitment set enabled=false where school_id=p_school and enabled;
    update public.class_schools set archived_at=coalesce(archived_at,now()) where id=p_school;
  else
    update public.class_schools set archived_at=null where id=p_school and archived_at is not null;
  end if;
end;
$$;
revoke all on function public.set_class_business_archived(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.set_class_business_archived(uuid,uuid,boolean) to service_role;

create or replace function public.read_class_school(p_school uuid, p_user uuid)
returns jsonb
language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id, 'name', s.name,
    'classes', coalesce((
      select jsonb_agg(to_jsonb(c) - 'school_id' order by c.name, c.id)
      from public.school_classes c
      where c.school_id = s.id and (
        s.owner_user_id = p_user or (e.participation_mode = 'open' and c.product_id is null and not exists (
          select 1 from public.school_class_assignments a join public.school_classes grouped on grouped.id=a.class_id
          where a.enrollment_id=e.id and grouped.product_id is not null
        )) or exists (
          select 1 from public.school_class_assignments a
          where a.school_id = s.id and a.enrollment_id = e.id and a.class_id = c.id
        )
      )
    ), '[]'::jsonb)
  )
  from public.class_schools s
  left join public.school_enrollments e on e.school_id = s.id and e.user_id = p_user and e.status = 'active'
  where s.id = p_school and s.archived_at is null and (s.owner_user_id = p_user or e.id is not null);
$$;

create or replace function public.apply_school_admission(p_application uuid, p_user uuid, p_name text)
returns void
language sql set search_path = ''
as $$
  with destination as (
    select a.school_id, a.class_id from public.school_admission_applications a
    join public.class_schools s on s.id=a.school_id and s.archived_at is null where a.application_id = p_application
  ), enrolled as (
    insert into public.school_enrollments (school_id, user_id, name)
    select d.school_id, p_user,
      left(coalesce(nullif(btrim(p_name), ''), nullif(btrim(p.display_name), ''), nullif(p.username, ''), '受講者'), 120)
    from destination d
    left join public.profiles p on p.user_id = p_user
    where p_user is not null
    on conflict (school_id, user_id) do nothing
    returning school_id, id
  )
  insert into public.school_class_assignments (school_id, enrollment_id, class_id)
  select e.school_id, e.id, d.class_id from enrolled e join destination d using (school_id)
  on conflict do nothing;
$$;

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
  if member.class_participation<>'flexible' or not public.class_runs_on(lesson.starts_on,lesson.cadence,p_day) or
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
  select count(*) into reserved from public.school_class_assignments a join public.school_enrollments e on e.id=a.enrollment_id
    where a.school_id=p_school and a.class_id=p_class and e.status='active' and e.class_participation<>'flexible';
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
    member.class_participation='flexible' or plan is null or (plan->>'makeup') not in ('approval','notice') or
    not public.class_runs_on(lesson.starts_on,lesson.cadence,p_day) or
    ((p_day+lesson.starts_at) at time zone 'Asia/Tokyo')<=now() or p_day>credit.expires_on or
    not exists(select 1 from public.school_class_assignments where enrollment_id=member.id and class_id=credit.source_class_id)
  then raise invalid_parameter_value; end if;
  if exists(select 1 from public.school_class_visit_reservations where makeup_id=p_makeup and class_id=p_class and visit_on=p_day) then return; end if;
  if exists(select 1 from public.school_class_assignments where enrollment_id=member.id and class_id=p_class) or
    exists(select 1 from public.school_class_visit_reservations where makeup_id=p_makeup or
      (enrollment_id=member.id and visit_on=p_day and class_id=p_class)) then raise invalid_parameter_value; end if;
  select count(*) into reserved from public.school_class_assignments a join public.school_enrollments e on e.id=a.enrollment_id
    where a.school_id=p_school and a.class_id=p_class and e.status='active' and e.class_participation<>'flexible';
  reserved := reserved + (select count(*) from public.school_class_visit_reservations where class_id=p_class and visit_on=p_day);
  if reserved >= (plan->>'capacity')::integer then raise exception 'class full' using errcode='P0001'; end if;
  insert into public.school_class_visit_reservations(school_id,enrollment_id,class_id,visit_on,makeup_id)
    values(p_school,member.id,p_class,p_day,p_makeup);
end;
$$;
