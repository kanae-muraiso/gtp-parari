-- Account confirmation links are private and require the matching verified PARARI email.
alter table public.school_admission_cases
  add column registration_token uuid not null default gen_random_uuid() unique,
  add column learner_token uuid not null default gen_random_uuid() unique,
  add column learner_user_id uuid references auth.users(id) on delete set null;

create index school_cases_applicant_user_idx on public.school_admission_cases(applicant_user_id);
create index school_cases_learner_user_idx on public.school_admission_cases(learner_user_id);
create index school_cases_enrollment_idx on public.school_admission_cases(enrollment_id);

create function public.class_member_access(p_actor uuid,p_school uuid,p_member uuid)
returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from public.school_enrollments e join public.class_schools s on s.id=e.school_id
    where e.id=p_member and e.school_id=p_school and e.status='active' and s.archived_at is null and
    (e.user_id=p_actor or exists(select 1 from public.school_admission_cases c where c.school_id=e.school_id
      and c.enrollment_id=e.id and c.applicant_user_id=p_actor and c.consent_at is not null
      and c.application_fields->>'guardianEmail' is not null)));
$$;
create function public.class_participant_members(p_actor uuid,p_school uuid)
returns jsonb language sql stable set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,
    'role',case when e.user_id=p_actor then 'learner' else 'guardian' end,
    'startsOn',(select min(c.starts_on) from public.school_admission_cases c where c.enrollment_id=e.id and c.school_id=e.school_id))
    order by e.name,e.id),'[]'::jsonb) from public.school_enrollments e
    where e.school_id=p_school and public.class_member_access(p_actor,p_school,e.id);
$$;

create function public.confirm_class_registration(p_token uuid,p_user uuid)
returns void language plpgsql set search_path='' as $$
declare c public.school_admission_cases%rowtype; child boolean; target_user uuid;
begin
  select * into strict c from public.school_admission_cases
    where registration_token=p_token or learner_token=p_token for update;
  child := c.learner_token=p_token;
  if c.decision in ('withdrawn','rejected') or not exists(select 1 from public.class_schools s
    where s.id=c.school_id and s.archived_at is null) then raise no_data_found; end if;
  if child then
    if c.applicant_audience is distinct from 'minor' or c.learner_email is null or lower(c.learner_email)=lower(c.applicant_email)
      or not public.verified_class_guardian(p_user,c.learner_email) or c.applicant_user_id=p_user
      or (c.learner_user_id is not null and c.learner_user_id<>p_user) then raise invalid_parameter_value; end if;
    update public.school_admission_cases set learner_user_id=p_user,revision=revision+case when learner_user_id is null then 1 else 0 end where id=c.id;
  else
    if not public.verified_class_guardian(p_user,c.applicant_email) or c.learner_user_id=p_user and c.applicant_audience='minor'
      or (c.applicant_user_id is not null and c.applicant_user_id<>p_user) then raise invalid_parameter_value; end if;
    update public.school_admission_cases set applicant_user_id=p_user,revision=revision+case when applicant_user_id is null then 1 else 0 end where id=c.id;
  end if;
  target_user := case when child then p_user when c.applicant_audience='adult' then p_user end;
  if target_user is not null and c.enrollment_id is not null then
    update public.school_enrollments set user_id=target_user where id=c.enrollment_id and school_id=c.school_id and user_id is null;
    if not found and not exists(select 1 from public.school_enrollments where id=c.enrollment_id and user_id=target_user) then raise invalid_parameter_value; end if;
  end if;
end;
$$;

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
  if candidate.applicant_audience in ('adult','minor') and (candidate.applicant_user_id is null or
    not public.verified_class_guardian(candidate.applicant_user_id,candidate.applicant_email)) then
    raise exception 'verified applicant account required' using errcode='P0006';
  end if;
  select terms into current_terms from public.school_admission_settings where school_id = p_school;
  if candidate.decision <> 'approved' or candidate.briefing not in ('skip', 'done') or candidate.test not in ('skip', 'graded')
     or candidate.starts_on is null or candidate.consent_at is null or candidate.agreed_terms is distinct from coalesce(current_terms, '')
     or (candidate.deadline is not null and candidate.deadline < (now() at time zone 'Asia/Tokyo')::date)
     or (candidate.payment = 'advance' and candidate.received_at is null)
     or (candidate.briefing_followup is not null and
       (candidate.applicant_user_id is null or candidate.application_fields is null)) then
    raise exception 'admission requirements incomplete' using errcode = '22023';
  end if;
  if candidate.applicant_audience='adult' or candidate.briefing_followup #>> '{design,audience}'='adult' then
    member_user := candidate.applicant_user_id;
  elsif candidate.applicant_audience='minor' then
    member_user := candidate.learner_user_id;
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

create function public.read_class_school_member(p_actor uuid,p_school uuid,p_member uuid)
returns jsonb
language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id, 'name', s.name,
    'classes', coalesce((
      select jsonb_agg(to_jsonb(c) - 'school_id' order by c.name, c.id)
      from public.school_classes c
      where c.school_id = s.id and (
        (e.participation_mode = 'open' and c.product_id is null and not exists (
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
  left join public.school_enrollments e on e.school_id = s.id and e.id = p_member and e.status = 'active'
  where s.id = p_school and s.archived_at is null and e.id is not null and public.class_member_access(p_actor,p_school,p_member);
$$;


create table public.school_attendance (
  school_id uuid not null,enrollment_id uuid not null,class_id uuid not null,lesson_date date not null,
  absence_reported boolean not null default false,actual text check(actual in ('present','absent')),
  primary key(school_id,class_id,lesson_date,enrollment_id),
  foreign key(school_id,enrollment_id) references public.school_enrollments(school_id,id) on delete cascade,
  foreign key(school_id,class_id) references public.school_classes(school_id,id) on delete cascade
);
create index school_attendance_enrollment_idx on public.school_attendance(school_id,enrollment_id);
alter table public.school_attendance enable row level security;
revoke all on public.school_attendance from public,anon,authenticated;
grant select,insert,update on public.school_attendance to service_role;

-- Count occupied fixed seats for one date, freeing seats only after an absence report.
create function public.class_fixed_seat_count_on(p_school uuid,p_class uuid,p_day date)
returns integer language sql stable set search_path='' as $$
  select count(*)::integer from public.school_class_assignments a
    join public.school_enrollments e on e.id=a.enrollment_id
  where a.school_id=p_school and a.class_id=p_class and e.status='active'
    and (a.self_selected or e.class_participation<>'flexible')
    and not exists(select 1 from public.school_attendance t where t.school_id=p_school
      and t.class_id=p_class and t.enrollment_id=e.id and t.lesson_date=p_day and t.absence_reported);
$$;
revoke all on function public.class_fixed_seat_count_on(uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.class_fixed_seat_count_on(uuid,uuid,date) to service_role;

create function public.manage_class_member_visit(p_actor uuid,p_member uuid,p_school uuid,p_class uuid,p_day date,p_cancel boolean)
returns void language plpgsql set search_path='' as $$
declare
  member public.school_enrollments%rowtype;
  lesson public.school_classes%rowtype;
  plan jsonb;
  used integer;
  reserved integer;
begin
  if not public.class_member_access(p_actor,p_school,p_member) then raise no_data_found; end if;
  if p_day < (select min(c.starts_on) from public.school_admission_cases c where c.school_id=p_school and c.enrollment_id=p_member)
    then raise invalid_parameter_value; end if;
  perform 1 from public.class_schools where id=p_school and archived_at is null for no key update;
  if not found then raise no_data_found; end if;
  -- Serialize changes to a member's monthly allowance and to the class's capacity.
  select * into strict member from public.school_enrollments where school_id=p_school and id=p_member and status='active' for update;
  select * into strict lesson from public.school_classes where school_id=p_school and id=p_class for update;
  if ((p_day+lesson.starts_at) at time zone 'Asia/Tokyo')<=now() then raise invalid_parameter_value; end if;
  if p_cancel then
    if exists(select 1 from public.school_class_visit_reservations where enrollment_id=p_member and class_id=p_class and visit_on=p_day and surcharge_paid_at is not null) then raise invalid_parameter_value; end if;
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
  reserved := public.class_fixed_seat_count_on(p_school,p_class,p_day);
  reserved := reserved + (select count(*) from public.school_class_visit_reservations where class_id=p_class and visit_on=p_day);
  if used >= (plan->>'monthlyVisits')::integer or reserved >= (plan->>'capacity')::integer then
    raise exception 'class visit capacity exceeded' using errcode='P0001';
  end if;
  insert into public.school_class_visit_reservations(school_id,enrollment_id,class_id,visit_on)
    values(p_school,member.id,p_class,p_day) on conflict do nothing;
end;
$$;

create function public.reserve_member_class_makeup(p_actor uuid,p_member uuid,p_school uuid,p_class uuid,p_day date,p_makeup uuid)
returns void language plpgsql set search_path='' as $$
declare
  member public.school_enrollments%rowtype;
  lesson public.school_classes%rowtype;
  credit public.school_class_makeups%rowtype;
  source_product uuid;
  plan jsonb;
  reserved integer;
begin
  if not public.class_member_access(p_actor,p_school,p_member) then raise no_data_found; end if;
  if p_day < (select min(c.starts_on) from public.school_admission_cases c where c.school_id=p_school and c.enrollment_id=p_member)
    then raise invalid_parameter_value; end if;
  perform 1 from public.class_schools where id=p_school and archived_at is null for no key update;
  if not found then raise no_data_found; end if;
  select * into strict member from public.school_enrollments where school_id=p_school and id=p_member and status='active' for update;
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
  reserved := public.class_fixed_seat_count_on(p_school,p_class,p_day);
  reserved := reserved + (select count(*) from public.school_class_visit_reservations where class_id=p_class and visit_on=p_day);
  if reserved >= (plan->>'capacity')::integer then raise exception 'class full' using errcode='P0001'; end if;
  insert into public.school_class_visit_reservations(school_id,enrollment_id,class_id,visit_on,makeup_id)
    values(p_school,member.id,p_class,p_day,p_makeup);
end;
$$;

create function public.choose_class_member_from_front(
  p_actor uuid,p_member uuid, p_school uuid, p_class uuid, p_day date, p_cancel boolean
) returns void language plpgsql set search_path='' as $$
declare
  member public.school_enrollments%rowtype;
  lesson public.school_classes%rowtype;
  plan jsonb;
  seats integer;
  today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  if not public.class_member_access(p_actor,p_school,p_member) then raise no_data_found; end if;
  if p_day < (select min(c.starts_on) from public.school_admission_cases c where c.school_id=p_school and c.enrollment_id=p_member)
    then raise invalid_parameter_value; end if;
  -- Serialize with teacher edits and the existing booking and makeup procedures.
  perform 1 from public.class_schools where id=p_school and archived_at is null for no key update;
  if not found then raise no_data_found; end if;
  select * into strict member from public.school_enrollments
    where school_id=p_school and id=p_member and status='active' for update;
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
  seats := public.class_fixed_seat_count_on(p_school,p_class,p_day);
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

create function public.reserve_priced_member_class_visit(p_actor uuid,p_member uuid,p_school uuid,p_class uuid,p_day date,p_makeup uuid,p_expected integer)
returns void language plpgsql set search_path='' as $$
declare
  quote integer;
begin
  if p_makeup is null then
    perform public.manage_class_member_visit(p_actor,p_member,p_school,p_class,p_day,false);
  else
    perform public.reserve_member_class_makeup(p_actor,p_member,p_school,p_class,p_day,p_makeup);
  end if;
  select r.surcharge_yen into strict quote from public.school_class_visit_reservations r join public.school_enrollments e on e.id=r.enrollment_id
    where r.school_id=p_school and r.class_id=p_class and r.visit_on=p_day and e.id=p_member;
  if quote is distinct from p_expected then raise exception 'class price changed' using errcode='P0003'; end if;
end;
$$;

grant delete on public.school_class_makeups to service_role;

create function public.report_class_member_absence(p_actor uuid,p_school uuid,p_member uuid,p_class uuid,p_day date,p_absent boolean)
returns void language plpgsql set search_path='' as $$
declare lesson public.school_classes%rowtype; plan jsonb; expires date;
begin
  perform 1 from public.class_schools where id=p_school and archived_at is null for no key update;
  if not found or not public.class_member_access(p_actor,p_school,p_member) then raise no_data_found; end if;
  perform 1 from public.school_enrollments e join public.school_class_assignments a on a.enrollment_id=e.id
    where e.id=p_member and a.class_id=p_class and (a.self_selected or e.class_participation<>'flexible') for update of e;
  if not found then raise invalid_parameter_value; end if;
  select * into strict lesson from public.school_classes where id=p_class and school_id=p_school for update;
  if p_day < (select min(c.starts_on) from public.school_admission_cases c where c.school_id=p_school and c.enrollment_id=p_member)
    or not public.school_class_runs_on(lesson.id,lesson.starts_on,lesson.cadence,p_day)
    or ((p_day+lesson.starts_at) at time zone 'Asia/Tokyo')<=now() then raise invalid_parameter_value; end if;
  plan := public.class_product_for_slot(p_school,p_class);
  if not p_absent then
    -- A released seat may have been booked by another member meanwhile.
    if exists(select 1 from public.school_attendance t where t.school_id=p_school and t.class_id=p_class
        and t.enrollment_id=p_member and t.lesson_date=p_day and t.absence_reported)
      and public.class_fixed_seat_count_on(p_school,p_class,p_day) +
        (select count(*) from public.school_class_visit_reservations r where r.class_id=p_class and r.visit_on=p_day)
        >= (plan->>'capacity')::integer then raise exception 'class full' using errcode='P0001'; end if;
    if exists(select 1 from public.school_class_makeups m join public.school_class_visit_reservations r on r.makeup_id=m.id
      where m.enrollment_id=p_member and m.source_class_id=p_class and m.missed_on=p_day) then raise invalid_parameter_value; end if;
    delete from public.school_class_makeups where enrollment_id=p_member and source_class_id=p_class and missed_on=p_day;
  end if;
  insert into public.school_attendance(school_id,enrollment_id,class_id,lesson_date,absence_reported)
    values(p_school,p_member,p_class,p_day,p_absent)
    on conflict(school_id,class_id,lesson_date,enrollment_id) do update set absence_reported=excluded.absence_reported;
  if p_absent and plan->>'makeup'='notice' then
    expires := (date_trunc('month',p_day::timestamp)+case when plan->>'makeupExpiry'='same_month' then interval '1 month' else interval '2 months' end-interval '1 day')::date;
    insert into public.school_class_makeups(school_id,enrollment_id,source_class_id,missed_on,expires_on)
      values(p_school,p_member,p_class,p_day,expires) on conflict(enrollment_id,source_class_id,missed_on) do nothing;
  end if;
end;
$$;

revoke all on function public.class_member_access(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.class_member_access(uuid,uuid,uuid) to service_role;

revoke all on function public.class_participant_members(uuid,uuid) from public,anon,authenticated;
grant execute on function public.class_participant_members(uuid,uuid) to service_role;

revoke all on function public.confirm_class_registration(uuid,uuid) from public,anon,authenticated;
grant execute on function public.confirm_class_registration(uuid,uuid) to service_role;

revoke all on function public.read_class_school_member(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_class_school_member(uuid,uuid,uuid) to service_role;

revoke all on function public.manage_class_member_visit(uuid,uuid,uuid,uuid,date,boolean) from public,anon,authenticated;
grant execute on function public.manage_class_member_visit(uuid,uuid,uuid,uuid,date,boolean) to service_role;

revoke all on function public.reserve_member_class_makeup(uuid,uuid,uuid,uuid,date,uuid) from public,anon,authenticated;
grant execute on function public.reserve_member_class_makeup(uuid,uuid,uuid,uuid,date,uuid) to service_role;

revoke all on function public.choose_class_member_from_front(uuid,uuid,uuid,uuid,date,boolean) from public,anon,authenticated;
grant execute on function public.choose_class_member_from_front(uuid,uuid,uuid,uuid,date,boolean) to service_role;

revoke all on function public.reserve_priced_member_class_visit(uuid,uuid,uuid,uuid,date,uuid,integer) from public,anon,authenticated;
grant execute on function public.reserve_priced_member_class_visit(uuid,uuid,uuid,uuid,date,uuid,integer) to service_role;

revoke all on function public.report_class_member_absence(uuid,uuid,uuid,uuid,date,boolean) from public,anon,authenticated;
grant execute on function public.report_class_member_absence(uuid,uuid,uuid,uuid,date,boolean) to service_role;
