create table public.school_class_monthly_schedules (
  class_id uuid not null references public.school_classes(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  days date[] not null default '{}',
  confirmed boolean not null default false,
  revision integer not null default 0,
  primary key (class_id, month),
  check (cardinality(days) <= 31)
);

alter table public.school_class_monthly_schedules enable row level security;
revoke all on public.school_class_monthly_schedules from public, anon, authenticated;
grant select, insert, update on public.school_class_monthly_schedules to service_role;

create function public.validate_school_class_monthly_schedule()
returns trigger language plpgsql set search_path='' as $$
begin
  -- The reservation procedures also lock this row before deciding whether the day is bookable.
  perform 1 from public.school_classes where id=new.class_id for update;
  if exists (
    select 1 from unnest(new.days) as selected(day)
    where day is null or day < new.month or day >= new.month + interval '1 month'
  ) then raise invalid_parameter_value; end if;
  if exists (
    select 1 from public.school_class_visit_reservations r
    where r.class_id=new.class_id and r.visit_on>=new.month and r.visit_on<new.month+interval '1 month'
      and not (r.visit_on=any(new.days))
  ) then raise exception 'class_calendar_reserved_day' using errcode='P0001'; end if;
  return new;
end;
$$;

revoke all on function public.validate_school_class_monthly_schedule() from public,anon,authenticated;
create trigger validate_school_class_monthly_schedule before insert or update
  on public.school_class_monthly_schedules for each row execute function public.validate_school_class_monthly_schedule();

create function public.school_class_runs_on(p_class uuid,p_first date,p_cadence text,p_day date)
returns boolean language sql stable set search_path='' as $$
  select coalesce(
    (select p_day=any(s.days) from public.school_class_monthly_schedules s
      where s.class_id=p_class and s.month=date_trunc('month',p_day::timestamp)::date),
    public.class_runs_on(p_first,p_cadence,p_day)
  );
$$;

revoke all on function public.school_class_runs_on(uuid,date,text,date) from public,anon,authenticated;
grant execute on function public.school_class_runs_on(uuid,date,text,date) to service_role;

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
  if member.class_participation<>'flexible' or not public.school_class_runs_on(lesson.id,lesson.starts_on,lesson.cadence,p_day) or
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
    not public.school_class_runs_on(lesson.id,lesson.starts_on,lesson.cadence,p_day) or
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

create or replace function public.grant_school_class_makeup(p_owner uuid,p_school uuid,p_member uuid,p_class uuid,p_day date)
returns void language plpgsql set search_path='' as $$
declare
  lesson public.school_classes%rowtype;
  plan jsonb;
  expires date;
begin
  perform 1 from public.school_enrollments e join public.class_schools s on s.id=e.school_id
    where e.id=p_member and e.school_id=p_school and e.status='active' and e.class_participation<>'flexible' and s.owner_user_id=p_owner
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
