-- Align starts to the clock independently of the appointment duration.
create or replace function public.generated_class_briefings(p_school uuid)
returns table(id uuid,starts_at timestamptz,channel text)
language sql stable set search_path = '' as $$
  select distinct md5(p_school::text||':'||extract(epoch from t.start_at)::bigint::text||':'||h.channel)::uuid, t.start_at, h.channel
  from public.school_recruitment r
  cross join lateral jsonb_to_recordset(r.office_hours) h(weekday integer, starts time, ends time, channel text)
  cross join lateral generate_series(0,7*r.booking_weeks) d(n)
  cross join lateral (select (now() at time zone 'Asia/Tokyo')::date+d.n as day) j
  cross join lateral generate_series(
    (j.day::timestamp + make_interval(mins => 30 * ceil(extract(epoch from h.starts) / 1800)::integer)) at time zone 'Asia/Tokyo',
    ((j.day+h.ends) at time zone 'Asia/Tokyo')-make_interval(mins=>r.office_duration),
    interval '30 minutes'
  ) t(start_at)
  where r.school_id=p_school and r.route='briefing' and extract(dow from j.day)=h.weekday;
$$;

create or replace function public.available_class_recruitment_slots(p_school uuid)
returns table(id uuid,starts_at timestamptz,channel text)
language sql stable set search_path = '' as $$
  with options as (
    select s.id,s.starts_at,s.channel,s.duration_minutes,s.capacity
    from public.school_recruitment_slots s where s.school_id=p_school and not s.closed and not s.generated
      and extract(epoch from s.starts_at) % 1800 = 0
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
    if slot.closed or extract(epoch from slot.starts_at) % 1800 <> 0
      or not public.class_briefing_available(r.school_id,slot.starts_at,
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
