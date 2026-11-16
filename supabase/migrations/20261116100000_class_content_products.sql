create table public.school_class_products (
  id uuid primary key,
  school_id uuid not null references public.class_schools(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  design jsonb not null check (jsonb_typeof(design)='object'),
  unique(school_id,id)
);
create index school_class_products_school_idx on public.school_class_products(school_id);
alter table public.school_class_products enable row level security;
revoke all on public.school_class_products from public,anon,authenticated;
grant select,insert,update on public.school_class_products to service_role;
alter table public.school_classes add column product_id uuid,
  add foreign key(school_id,product_id) references public.school_class_products(school_id,id);
create index school_classes_product_idx on public.school_classes(product_id) where product_id is not null;

create function public.save_school_content_product(p_owner uuid,p_school uuid,p_product uuid,p_name text,p_design jsonb,p_classes uuid[])
returns void language plpgsql set search_path='' as $$
begin
  perform 1 from public.class_schools where id=p_school and owner_user_id=p_owner for update;
  if not found then raise no_data_found; end if;
  if exists(
    select 1 from unnest(p_classes) c(id) where not exists(select 1 from public.school_classes s
      where s.id=c.id and s.school_id=p_school and (s.product_id is null or s.product_id=p_product))
  ) then raise invalid_parameter_value; end if;
  -- Existing membership and reservation links determine whether a schedule can be moved safely.
  if exists(
    select 1 from public.school_class_assignments a join public.school_class_assignments b on a.enrollment_id=b.enrollment_id
    where a.school_id=p_school and a.class_id=any(p_classes) and not(b.class_id=any(p_classes))
  ) or exists (
    select 1 from public.school_classes c where c.school_id=p_school and c.product_id=p_product and not(c.id=any(p_classes))
      and (exists(select 1 from public.school_class_assignments a where a.class_id=c.id) or
           exists(select 1 from public.school_class_visit_reservations r where r.class_id=c.id))
  ) then raise invalid_parameter_value; end if;
  if exists(select 1 from public.school_class_products where id=p_product and school_id<>p_school) then raise no_data_found; end if;
  insert into public.school_class_products(id,school_id,name,design) values(p_product,p_school,p_name,p_design)
    on conflict(id) do update set name=excluded.name,design=excluded.design;
  update public.school_classes set product_id=null where school_id=p_school and product_id=p_product and not(id=any(p_classes));
  update public.school_classes set product_id=p_product where school_id=p_school and id=any(p_classes);
end;
$$;
revoke all on function public.save_school_content_product(uuid,uuid,uuid,text,jsonb,uuid[]) from public,anon,authenticated;
grant execute on function public.save_school_content_product(uuid,uuid,uuid,text,jsonb,uuid[]) to service_role;

create function public.class_product_for_slot(p_school uuid,p_class uuid)
returns jsonb language sql stable set search_path='' as $$
  select case when c.product_id is not null then p.design || jsonb_build_object('classIds',(
    select jsonb_agg(other.id order by other.id) from public.school_classes other where other.product_id=c.product_id and other.school_id=p_school
  )) else legacy.design || jsonb_build_object('classIds',coalesce((
    select jsonb_agg(other.id order by other.id) from public.school_classes other where other.school_id=p_school
    and other.product_id is null and (legacy.design->'classIds') ? other.id::text
  ),'[]'::jsonb)) end
  from public.school_classes c
  left join public.school_class_products p on p.id=c.product_id and p.school_id=c.school_id
  left join public.school_class_product_designs legacy on legacy.school_id=c.school_id
  where c.id=p_class and c.school_id=p_school;
$$;
revoke all on function public.class_product_for_slot(uuid,uuid) from public,anon,authenticated;
grant execute on function public.class_product_for_slot(uuid,uuid) to service_role;

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
  delete from public.school_class_assignments where school_id=p_school and enrollment_id=p_member and not(class_id=any(p_classes));
  insert into public.school_class_assignments(school_id,enrollment_id,class_id)
    select p_school,p_member,c from unnest(p_classes) c on conflict do nothing;
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
  update public.school_admission_cases set enrollment_id = member_id, revision = revision + 1
  where id = candidate.id;
end;
$$;

create table public.school_class_makeups (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  enrollment_id uuid not null,
  source_class_id uuid not null,
  missed_on date not null,
  expires_on date not null,
  unique(enrollment_id,source_class_id,missed_on),
  foreign key(school_id,enrollment_id) references public.school_enrollments(school_id,id) on delete cascade,
  foreign key(school_id,source_class_id) references public.school_classes(school_id,id) on delete cascade
);
alter table public.school_class_makeups enable row level security;
revoke all on public.school_class_makeups from public,anon,authenticated;
grant select,insert on public.school_class_makeups to service_role;
alter table public.school_class_visit_reservations add column makeup_id uuid unique references public.school_class_makeups(id) on delete cascade;

create function public.grant_school_class_makeup(p_owner uuid,p_school uuid,p_member uuid,p_class uuid,p_day date)
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
    where c.id=p_class and c.school_id=p_school and a.enrollment_id=p_member;
  plan := public.class_product_for_slot(p_school,p_class);
  if lesson.product_id is null or plan is null or (plan->>'makeup') not in ('approval','notice') or
    not public.class_runs_on(lesson.starts_on,lesson.cadence,p_day) or
    ((p_day+lesson.starts_at) at time zone 'Asia/Tokyo')>now() then raise invalid_parameter_value; end if;
  expires := (date_trunc('month',p_day::timestamp) +
    case when plan->>'makeupExpiry'='same_month' then interval '1 month' else interval '2 months' end - interval '1 day')::date;
  if expires < (now() at time zone 'Asia/Tokyo')::date then raise invalid_parameter_value; end if;
  insert into public.school_class_makeups(school_id,enrollment_id,source_class_id,missed_on,expires_on)
    values(p_school,p_member,p_class,p_day,expires) on conflict(enrollment_id,source_class_id,missed_on) do nothing;
end;
$$;
revoke all on function public.grant_school_class_makeup(uuid,uuid,uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.grant_school_class_makeup(uuid,uuid,uuid,uuid,date) to service_role;

create function public.reserve_school_class_makeup(p_user uuid,p_school uuid,p_class uuid,p_day date,p_makeup uuid)
returns void language plpgsql set search_path='' as $$
declare
  member public.school_enrollments%rowtype;
  lesson public.school_classes%rowtype;
  credit public.school_class_makeups%rowtype;
  source_product uuid;
  plan jsonb;
  reserved integer;
begin
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
revoke all on function public.reserve_school_class_makeup(uuid,uuid,uuid,date,uuid) from public,anon,authenticated;
grant execute on function public.reserve_school_class_makeup(uuid,uuid,uuid,date,uuid) to service_role;
create or replace function public.manage_class_visit(p_user uuid,p_school uuid,p_class uuid,p_day date,p_cancel boolean)
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

create function public.save_school_content_slot(
  p_owner uuid,p_school uuid,p_class uuid,p_new boolean,p_school_name text,p_class_name text,
  p_starts_on date,p_starts_at time,p_cadence text,p_location text,p_delivery text,p_meeting_url text,p_duration integer,p_product uuid
) returns uuid language plpgsql set search_path='' as $$
begin
  if p_product is not null and (not p_new or not exists(select 1 from public.school_class_products
    where id=p_product and school_id=p_school)) then raise invalid_parameter_value; end if;
  perform public.save_school_class(p_owner,p_school,p_class,p_new,p_school_name,p_class_name,
    p_starts_on,p_starts_at,p_cadence,p_location,p_delivery,p_meeting_url,p_duration);
  if p_product is not null then
    update public.school_classes set product_id=p_product where id=p_class and school_id=p_school and product_id is null;
  end if;
  return p_class;
end;
$$;
revoke all on function public.save_school_content_slot(uuid,uuid,uuid,boolean,text,text,date,time,text,text,text,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.save_school_content_slot(uuid,uuid,uuid,boolean,text,text,date,time,text,text,text,text,integer,uuid) to service_role;

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
  where s.id = p_school and (s.owner_user_id = p_user or e.id is not null);
$$;

create function public.add_school_slot_member(p_owner uuid,p_school uuid,p_member uuid,p_name text,p_user uuid,p_class uuid)
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
  insert into public.school_enrollments(id,school_id,name,user_id) values(p_member,p_school,p_name,p_user);
  insert into public.school_class_assignments(school_id,enrollment_id,class_id) values(p_school,p_member,p_class);
end;
$$;
revoke all on function public.add_school_slot_member(uuid,uuid,uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.add_school_slot_member(uuid,uuid,uuid,text,uuid,uuid) to service_role;
