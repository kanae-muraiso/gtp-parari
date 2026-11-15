-- Keep one office calendar per school, with independently published recruitment links.
create table public.school_recruitment_offers (
  id uuid primary key,
  school_id uuid not null references public.school_recruitment(school_id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  information text not null default '' check (char_length(information) <= 4000),
  class_ids uuid[] not null check (cardinality(class_ids) > 0),
  enabled boolean not null default false,
  unique (school_id,id)
);
create index school_recruitment_offers_school_idx on public.school_recruitment_offers(school_id);
alter table public.school_recruitment_offers enable row level security;
revoke all on public.school_recruitment_offers from public, anon, authenticated;
grant select, insert, update on public.school_recruitment_offers to service_role;

alter table public.school_admission_cases
  add column recruitment_offer_id uuid,
  add column requested_class_id uuid,
  add foreign key (school_id,recruitment_offer_id) references public.school_recruitment_offers(school_id,id),
  add foreign key (school_id,requested_class_id) references public.school_classes(school_id,id);
drop index public.school_direct_application_unique;
create unique index school_direct_application_unique
  on public.school_admission_cases (school_id, applicant_email, name)
  where source='public' and intake_slot_id is null and recruitment_offer_id is null and applicant_email is not null and decision <> 'withdrawn';
create unique index school_offer_direct_application_unique
  on public.school_admission_cases(recruitment_offer_id, requested_class_id, applicant_email, name)
  where source='public' and intake_slot_id is null and recruitment_offer_id is not null and applicant_email is not null and decision <> 'withdrawn';

create function public.save_school_class(
  p_owner uuid, p_school uuid, p_class uuid, p_new boolean, p_school_name text, p_class_name text,
  p_starts_on date, p_starts_at time, p_cadence text, p_location text, p_delivery text, p_meeting_url text, p_duration integer
) returns uuid language plpgsql set search_path='' as $$
begin
  if p_school is null then
    if not p_new then raise no_data_found; end if;
    insert into public.class_schools(owner_user_id,name) values(p_owner,p_school_name) returning id into p_school;
  else
    update public.class_schools set name=p_school_name where id=p_school and owner_user_id=p_owner and tier='a';
    if not found then raise no_data_found; end if;
  end if;
  perform 1 from public.school_recruitment where school_id=p_school for no key update;
  if p_new then
    if exists(select 1 from public.school_classes where id=p_class and school_id<>p_school) then raise no_data_found; end if;
    insert into public.school_classes(id,school_id,name,starts_on,starts_at,cadence,location,delivery,meeting_url,duration_minutes)
    values(p_class,p_school,p_class_name,p_starts_on,p_starts_at,p_cadence,p_location,p_delivery,p_meeting_url,p_duration)
    on conflict(id) do nothing;
  else
    update public.school_classes set name=p_class_name,starts_on=p_starts_on,starts_at=p_starts_at,cadence=p_cadence,
      location=p_location,delivery=p_delivery,meeting_url=p_meeting_url,duration_minutes=p_duration
    where id=p_class and school_id=p_school;
    if not found then raise no_data_found; end if;
  end if;
  return p_class;
end;
$$;
revoke all on function public.save_school_class(uuid,uuid,uuid,boolean,text,text,date,time,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.save_school_class(uuid,uuid,uuid,boolean,text,text,date,time,text,text,text,text,integer) to service_role;

grant delete on public.school_class_assignments to service_role;
create function public.set_school_member_classes(p_owner uuid,p_school uuid,p_member uuid,p_classes uuid[],p_mode text)
returns void language plpgsql set search_path='' as $$
begin
  perform 1 from public.school_enrollments e join public.class_schools s on s.id=e.school_id
    where e.school_id=p_school and e.id=p_member and s.owner_user_id=p_owner for update of e;
  if not found then raise no_data_found; end if;
  if p_mode not in ('fixed','multiple','flexible') or coalesce(cardinality(p_classes),0)<1 or
    (p_mode='fixed' and cardinality(p_classes)<>1) or
    exists(select 1 from unnest(p_classes) c(id) where not exists(select 1 from public.school_classes sc where sc.school_id=p_school and sc.id=c.id))
  then raise invalid_parameter_value; end if;
  update public.school_enrollments set participation_mode='assigned', class_participation=p_mode where id=p_member;
  delete from public.school_class_assignments where school_id=p_school and enrollment_id=p_member and not(class_id=any(p_classes));
  insert into public.school_class_assignments(school_id,enrollment_id,class_id)
    select p_school,p_member,c from unnest(p_classes) c on conflict do nothing;
end;
$$;
alter table public.school_enrollments add column class_participation text
  not null default 'fixed' check (class_participation in ('fixed','multiple','flexible'));
revoke all on function public.set_school_member_classes(uuid,uuid,uuid,uuid[],text) from public,anon,authenticated;
grant execute on function public.set_school_member_classes(uuid,uuid,uuid,uuid[],text) to service_role;

create or replace function public.add_class_a_member(
  p_owner uuid, p_school uuid, p_member uuid, p_name text, p_user uuid
) returns void
language plpgsql set search_path = ''
as $$
declare
  v_class uuid;
  v_member uuid;
begin
  select c.id into strict v_class
  from public.school_classes c
  join public.class_schools s on s.id = c.school_id
  where s.id = p_school and s.owner_user_id = p_owner and s.tier = 'a' order by c.starts_on,c.id limit 1;

  if p_user is null then
    insert into public.school_enrollments (id, school_id, name) values (p_member, p_school, p_name)
    on conflict (id) do nothing
    returning id into v_member;
  else
    insert into public.school_enrollments (id, school_id, name, user_id) values (p_member, p_school, p_name, p_user)
    on conflict (school_id, user_id) do update set status = 'active'
    returning id into v_member;
  end if;

  if v_member is not null then
    insert into public.school_class_assignments (school_id, enrollment_id, class_id)
    values (p_school, v_member, v_class) on conflict do nothing;
  end if;
end;
$$;


create function public.submit_school_offer(
  p_public uuid,p_offer uuid,p_class uuid,p_slot uuid,p_name text,p_applicant text,p_email text,
  p_information text,p_terms text,p_phone text
) returns table(case_id uuid,starts_at timestamptz,school_name text,kind text)
language plpgsql set search_path='' as $$
declare
  offer public.school_recruitment_offers%rowtype;
  recruitment public.school_recruitment%rowtype;
  candidate public.school_admission_cases%rowtype;
  booked record;
  terms text;
begin
  select * into strict recruitment from public.school_recruitment where public_id=p_public and enabled for update;
  select * into strict offer from public.school_recruitment_offers
    where id=p_offer and school_id=recruitment.school_id and enabled for share;
  if offer.information is distinct from p_information or p_class is null or not(p_class=any(offer.class_ids)) or
    not exists(select 1 from public.school_classes where school_id=offer.school_id and id=p_class)
  then raise invalid_parameter_value; end if;
  if recruitment.route='briefing' then
    select * into strict booked from public.book_school_intake(p_public,p_slot,p_name,p_applicant,p_email,recruitment.information,p_phone);
    update public.school_admission_cases c set recruitment_offer_id=p_offer, requested_class_id=p_class, intake_agreement=p_information
      where id=booked.case_id and (recruitment_offer_id is null or recruitment_offer_id=p_offer and requested_class_id=p_class);
    if not found then raise invalid_parameter_value; end if;
    return query select booked.case_id, booked.starts_at, booked.school_name, booked.kind;
  else
    if not exists(select 1 from public.class_schools s join public.profiles p on p.user_id=s.owner_user_id
      where s.id=offer.school_id and p.is_monitor) then raise no_data_found; end if;
    select settings.terms into terms from public.school_admission_settings settings where school_id=offer.school_id;
    if coalesce(terms,'') is distinct from p_terms then raise invalid_parameter_value; end if;
    select * into candidate from public.school_admission_cases
      where recruitment_offer_id=p_offer and requested_class_id=p_class and applicant_email=p_email and name=p_name
        and source='public' and intake_slot_id is null and decision <> 'withdrawn';
    if not found then
      insert into public.school_admission_cases(id,school_id,name,contact,source,briefing,test,decision,payment,applicant_email,
        applicant_name,intake_agreement,consent_at,agreed_terms,recruitment_offer_id,requested_class_id)
      values(gen_random_uuid(),offer.school_id,p_name,p_email,'public','skip','skip','pending',recruitment.payment_mode,p_email,
        p_applicant,p_information,now(),p_terms,p_offer,p_class) returning * into candidate;
    end if;
    return query select candidate.id,null::timestamptz,s.name,recruitment.kind from public.class_schools s where s.id=offer.school_id;
  end if;
end;
$$;
revoke all on function public.submit_school_offer(uuid,uuid,uuid,uuid,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_school_offer(uuid,uuid,uuid,uuid,text,text,text,text,text,text) to service_role;

create or replace function public.submit_direct_class_application(
  p_public uuid, p_name text, p_applicant text, p_email text, p_information text, p_terms text
) returns uuid language plpgsql set search_path = '' as $$
declare
  r public.school_recruitment%rowtype;
  current_terms text;
  result_id uuid;
begin
  select * into strict r from public.school_recruitment
  where public_id=p_public and enabled and route='direct' for update;
  if not exists(select 1 from public.class_schools s join public.profiles p on p.user_id=s.owner_user_id
    where s.id=r.school_id and p.is_monitor) then raise no_data_found; end if;
  select terms into current_terms from public.school_admission_settings where school_id=r.school_id;
  if r.information is distinct from p_information or coalesce(current_terms,'') is distinct from p_terms then
    raise invalid_parameter_value;
  end if;
  select id into result_id from public.school_admission_cases
  where school_id=r.school_id and applicant_email=p_email and name=p_name and source='public'
    and intake_slot_id is null and recruitment_offer_id is null and decision <> 'withdrawn';
  if result_id is not null then return result_id; end if;
  insert into public.school_admission_cases
    (id,school_id,name,contact,source,briefing,test,decision,payment,applicant_email,applicant_name,intake_agreement,consent_at,agreed_terms)
  values(gen_random_uuid(),r.school_id,p_name,p_email,'public','skip','skip','pending',r.payment_mode,p_email,p_applicant,p_information,now(),p_terms)
  returning id into result_id;
  return result_id;
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
      select design into product from public.school_class_product_designs where school_id=p_school;
      if product->>'booking'='flexible' and (product->'classIds') ? candidate.requested_class_id::text then
        select array_agg(c.id order by c.id) into eligible from public.school_classes c
          where c.school_id=p_school and (product->'classIds') ? c.id::text;
        perform public.set_school_member_classes(p_owner,p_school,member_id,eligible,'flexible');
      else
        perform public.set_school_member_classes(p_owner,p_school,member_id,array[candidate.requested_class_id],'fixed');
      end if;
    else
      insert into public.school_class_assignments(school_id,enrollment_id,class_id)
        values(p_school,member_id,candidate.requested_class_id) on conflict do nothing;
      update public.school_enrollments set class_participation='multiple'
        where id=member_id and class_participation='fixed'
        and (select count(*) from public.school_class_assignments where school_id=p_school and enrollment_id=member_id)>1;
    end if;
  end if;
  update public.school_admission_cases set enrollment_id = member_id, revision = revision + 1
  where id = candidate.id;
end;
$$;

create table public.school_class_visit_reservations (
  school_id uuid not null,
  enrollment_id uuid not null,
  class_id uuid not null,
  visit_on date not null,
  primary key(enrollment_id,class_id,visit_on),
  foreign key(school_id,enrollment_id) references public.school_enrollments(school_id,id) on delete cascade,
  foreign key(school_id,class_id) references public.school_classes(school_id,id) on delete cascade
);
create index school_class_visit_capacity_idx on public.school_class_visit_reservations(class_id,visit_on);
alter table public.school_class_visit_reservations enable row level security;
revoke all on public.school_class_visit_reservations from public, anon, authenticated;
grant select, insert, delete on public.school_class_visit_reservations to service_role;

create function public.class_runs_on(p_first date,p_cadence text,p_day date)
returns boolean language sql immutable set search_path='' as $$
  select p_day>=p_first and case when p_cadence='weekly' then (p_day-p_first)%7=0 else
    extract(day from p_day)=least(extract(day from p_first),extract(day from date_trunc('month',p_day::timestamp)+interval '1 month - 1 day')) end;
$$;
revoke all on function public.class_runs_on(date,text,date) from public,anon,authenticated;
grant execute on function public.class_runs_on(date,text,date) to service_role;

create function public.manage_class_visit(p_user uuid,p_school uuid,p_class uuid,p_day date,p_cancel boolean)
returns void language plpgsql set search_path='' as $$
declare
  member public.school_enrollments%rowtype;
  lesson public.school_classes%rowtype;
  plan jsonb;
  used integer;
  reserved integer;
begin
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
  select design into plan from public.school_class_product_designs where school_id=p_school;
  if plan is null or not ((plan->'classIds') ? p_class::text) then raise invalid_parameter_value; end if;
  select count(*) into used from public.school_class_visit_reservations where enrollment_id=member.id
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
revoke all on function public.manage_class_visit(uuid,uuid,uuid,date,boolean) from public,anon,authenticated;
grant execute on function public.manage_class_visit(uuid,uuid,uuid,date,boolean) to service_role;

create or replace function public.set_class_a_admission(p_owner uuid, p_school uuid, p_application uuid)
returns void
language plpgsql set search_path = ''
as $$
declare
  v_class uuid;
  v_previous uuid;
begin
  perform 1 from public.class_schools where id = p_school and owner_user_id = p_owner and tier = 'a' for update;
  if not found then raise no_data_found; end if;
  select id into strict v_class from public.school_classes where school_id = p_school order by starts_on,id limit 1;
  select application_id into v_previous from public.school_admission_applications where school_id = p_school;

  perform 1 from public.applications where id in (v_previous, p_application) order by id for no key update;
  if p_application is not null and not exists (
    select 1 from public.applications
    where id = p_application and owner_user_id = p_owner and application_type = 'SCHOOL'
      and origin = 'manual' and calendar_item_id is null and archived_at is null
  ) then raise no_data_found; end if;

  if v_previous is not distinct from p_application then return; end if;
  delete from public.school_admission_applications where school_id = p_school;
  if p_application is null then return; end if;

  insert into public.school_admission_applications (application_id, school_id, class_id)
  values (p_application, p_school, v_class);

  -- Include completed admissions from before the operator linked the form.
  perform public.apply_school_admission(p_application, entry.user_id, entry.applicant_name)
  from (
    select distinct on (user_id) user_id, applicant_name
    from public.application_entries
    where application_id = p_application and status = 'confirmed' and user_id is not null
      and calendar_occurrence_id is null and calendar_recurring_booking_id is null
    order by user_id, created_at, id
  ) entry;
end;
$$;
