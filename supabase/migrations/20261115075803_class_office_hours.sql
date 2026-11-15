alter table public.school_recruitment
  add column office_hours jsonb not null default '[]' check (jsonb_typeof(office_hours)='array'),
  add column office_duration integer not null default 30 check (office_duration between 5 and 480),
  add column office_location text;
alter table public.school_recruitment_slots add column channel text not null default 'onsite' check (channel in ('onsite','phone')),
  add column generated boolean not null default false;
alter table public.school_classes add column duration_minutes integer not null default 60 check (duration_minutes between 5 and 480);

create function public.class_recurrences(p_school uuid,p_day date)
returns table(title text, starts_at timestamptz, ends_at timestamptz)
language sql stable set search_path = '' as $$
  select c.name, (p_day+c.starts_at) at time zone 'Asia/Tokyo',
    ((p_day+c.starts_at) at time zone 'Asia/Tokyo')+make_interval(mins=>c.duration_minutes)
  from public.school_classes c where c.school_id=p_school and p_day>=c.starts_on
    and (case when c.cadence='weekly' then (p_day-c.starts_on)%7=0
         else extract(day from p_day)=least(extract(day from c.starts_on),extract(day from
           date_trunc('month',p_day::timestamp)+interval '1 month - 1 day')) end);
$$;

create function public.class_briefing_available(p_school uuid,p_start timestamptz,p_duration integer,p_weeks integer,p_slot uuid)
returns boolean language sql stable set search_path = '' as $$
  select public.class_slot_in_booking_window(p_school,p_start,p_duration,p_weeks)
    and not exists (
      select 1 from generate_series(-1,1) as offset_day(n)
      cross join lateral public.class_recurrences(p_school,(p_start at time zone 'Asia/Tokyo')::date+n) c
      where c.starts_at<p_start+make_interval(mins=>p_duration) and c.ends_at>p_start
    )
    and not exists (
      select 1 from public.school_recruitment_slots s
      where s.school_id=p_school and s.id<>p_slot
        and s.starts_at<p_start+make_interval(mins=>p_duration)
        and s.starts_at+make_interval(mins=>s.duration_minutes)>p_start
        and exists(select 1 from public.school_admission_cases c where c.intake_slot_id=s.id and c.decision<>'withdrawn')
    );
$$;

create function public.generated_class_briefings(p_school uuid)
returns table(id uuid,starts_at timestamptz,channel text)
language sql stable set search_path = '' as $$
  select distinct md5(p_school::text||':'||extract(epoch from t.start_at)::bigint::text||':'||h.channel)::uuid, t.start_at, h.channel
  from public.school_recruitment r
  cross join lateral jsonb_to_recordset(r.office_hours) h(weekday integer, starts time, ends time, channel text)
  cross join lateral generate_series(0,7*r.booking_weeks) d(n)
  cross join lateral (select (now() at time zone 'Asia/Tokyo')::date+d.n as day) j
  cross join lateral generate_series(
    (j.day+h.starts) at time zone 'Asia/Tokyo',
    ((j.day+h.ends) at time zone 'Asia/Tokyo')-make_interval(mins=>r.office_duration),
    make_interval(mins=>r.office_duration)
  ) t(start_at)
  where r.school_id=p_school and r.route='briefing' and extract(dow from j.day)=h.weekday;
$$;

drop function public.available_class_recruitment_slots(uuid);
create function public.available_class_recruitment_slots(p_school uuid)
returns table(id uuid,starts_at timestamptz,channel text)
language sql stable set search_path = '' as $$
  with options as (
    select s.id,s.starts_at,s.channel,s.duration_minutes,s.capacity
    from public.school_recruitment_slots s where s.school_id=p_school and not s.closed and not s.generated
    union all
    select g.id,g.starts_at,g.channel,r.office_duration,1
    from public.generated_class_briefings(p_school) g join public.school_recruitment r on r.school_id=p_school
    where not exists(select 1 from public.school_recruitment_slots s where s.id=g.id and s.closed)
  )
  select o.id,o.starts_at,o.channel from options o
  join public.school_recruitment r on r.school_id=p_school and r.route='briefing'
  where public.class_briefing_available(p_school,o.starts_at,o.duration_minutes,r.booking_weeks,o.id)
    and (select count(*) from public.school_admission_cases c where c.intake_slot_id=o.id and c.decision<>'withdrawn') < o.capacity
  order by o.starts_at,o.channel,o.id;
$$;

create function public.class_recruitment_calendar(p_school uuid,p_start date)
returns table(starts_at timestamptz,ends_at timestamptz,label text,kind text)
language sql stable set search_path = '' as $$
  with bounds as (
    select p_start::timestamp at time zone 'Asia/Tokyo' as first_at,
      (p_start+7)::timestamp at time zone 'Asia/Tokyo' as last_at
  )
  select c.starts_at,c.ends_at,c.title,'class' from generate_series(-1,6) d(n)
    cross join lateral public.class_recurrences(p_school,p_start+d.n) c
    cross join bounds b where c.ends_at>b.first_at
  union all
  select s.starts_at,s.starts_at+make_interval(mins=>s.duration_minutes),'説明会・体験の予約','booked'
    from public.school_recruitment_slots s cross join bounds b
    where s.school_id=p_school and s.starts_at<b.last_at and s.starts_at+make_interval(mins=>s.duration_minutes)>b.first_at
      and exists(select 1 from public.school_admission_cases c where c.intake_slot_id=s.id and c.decision<>'withdrawn')
  union all
  select x.starts_at,x.ends_at,'予約不可','block' from public.school_recruitment_blocks x cross join bounds b
    where x.school_id=p_school and x.starts_at<b.last_at and x.ends_at>b.first_at;
$$;

revoke all on function public.class_recurrences(uuid,date),public.class_briefing_available(uuid,timestamptz,integer,integer,uuid),
  public.generated_class_briefings(uuid),public.available_class_recruitment_slots(uuid),public.class_recruitment_calendar(uuid,date)
  from public,anon,authenticated;
grant execute on function public.class_recurrences(uuid,date),public.class_briefing_available(uuid,timestamptz,integer,integer,uuid),
  public.generated_class_briefings(uuid),public.available_class_recruitment_slots(uuid),public.class_recruitment_calendar(uuid,date)
  to service_role;

alter table public.school_admission_cases add column applicant_phone text;
drop function public.book_school_intake(uuid,uuid,text,text,text,text);

create or replace function public.book_school_intake(p_public uuid,p_slot uuid,p_name text,p_applicant text,p_email text,p_agreement text,p_phone text default null)
returns table(case_id uuid, starts_at timestamptz, school_name text, kind text)
language plpgsql set search_path = '' as $$
declare
  r public.school_recruitment%rowtype;
  slot public.school_recruitment_slots%rowtype;
  school public.class_schools%rowtype;
  candidate uuid;
  generated_slot record;
begin
  select * into strict r from public.school_recruitment where public_id=p_public and enabled and route='briefing' for no key update;
  select * into strict school from public.class_schools where id=r.school_id;
  if not exists(select 1 from public.profiles where user_id=school.owner_user_id and is_monitor) then raise no_data_found; end if;
  if r.information is distinct from p_agreement then raise invalid_parameter_value; end if;
  select * into slot from public.school_recruitment_slots
    where id=p_slot and school_id=r.school_id for update;
  if not found then
    select * into generated_slot from public.generated_class_briefings(r.school_id) g where g.id=p_slot;
    if not found then raise exception 'slot unavailable' using errcode='P0001'; end if;
    insert into public.school_recruitment_slots(id,school_id,starts_at,capacity,duration_minutes,location,channel,generated)
    values(p_slot,r.school_id,generated_slot.starts_at,1,r.office_duration,
      case when generated_slot.channel='onsite' then r.office_location end,generated_slot.channel,true)
    returning * into slot;
  end if;
  select id into candidate from public.school_admission_cases
    where intake_slot_id=p_slot and applicant_email=p_email and name=p_name and decision<>'withdrawn';
  if candidate is null then
    if slot.closed or not public.class_briefing_available(r.school_id,slot.starts_at,
        case when slot.generated then r.office_duration else slot.duration_minutes end,r.booking_weeks,slot.id)
      or (slot.generated and not exists (select 1 from public.generated_class_briefings(r.school_id) g where g.id=p_slot)) then
      raise exception 'slot unavailable' using errcode='P0001';
    end if;
    if (select count(*) from public.school_admission_cases where intake_slot_id=p_slot and decision<>'withdrawn') >= slot.capacity then
      raise exception 'slot full' using errcode='P0001';
    end if;
    if slot.generated then
      update public.school_recruitment_slots set duration_minutes=r.office_duration,
        location=case when slot.channel='onsite' then r.office_location end where id=slot.id;
    end if;
    if slot.channel='phone' and (p_phone is null or length(p_phone) not between 7 and 30) then
      raise invalid_parameter_value;
    end if;
    candidate := gen_random_uuid();
    insert into public.school_admission_cases
      (id,school_id,name,contact,source,briefing,briefing_at,test,decision,payment,intake_slot_id,applicant_email,applicant_name,intake_agreement,applicant_phone)
    values(candidate,r.school_id,p_name,p_email,'public','booked',slot.starts_at,
      case when exists(select 1 from public.school_admission_settings where school_id=r.school_id and test) then 'pending' else 'skip' end,
      'pending','free',p_slot,p_email,p_applicant,p_agreement,case when slot.channel='phone' then p_phone end);
  end if;
  return query select candidate, slot.starts_at, school.name, r.kind;
end;
$$;

revoke all on function public.book_school_intake(uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.book_school_intake(uuid,uuid,text,text,text,text,text) to service_role;

create function public.save_class_delivery_with_duration(
  p_owner uuid, p_school uuid, p_school_name text, p_class_name text,
  p_starts_on date, p_starts_at time, p_cadence text, p_location text,
  p_delivery text, p_meeting_url text, p_duration integer
) returns void language plpgsql set search_path = '' as $$
begin
  if p_school is null then
    p_school := public.create_class_a(p_owner,p_school_name,p_class_name,p_starts_on,p_starts_at,p_cadence,p_location);
  else
    update public.class_schools set name=p_school_name where id=p_school and owner_user_id=p_owner and tier='a';
    if not found then raise no_data_found; end if;
  end if;
  perform 1 from public.school_recruitment where school_id=p_school for no key update;
  update public.school_classes set duration_minutes=p_duration, name=p_class_name, starts_on=p_starts_on, starts_at=p_starts_at,
    cadence=p_cadence, location=p_location, delivery=p_delivery, meeting_url=p_meeting_url where school_id=p_school;
end;
$$;
revoke all on function public.save_class_delivery_with_duration(uuid,uuid,text,text,date,time,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.save_class_delivery_with_duration(uuid,uuid,text,text,date,time,text,text,text,text,integer) to service_role;
