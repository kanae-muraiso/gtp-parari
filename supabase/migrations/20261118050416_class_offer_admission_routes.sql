-- Per-content admission routes inherit the business default unless explicitly set.
alter table public.school_recruitment_offers
  add column route_override text check (route_override in ('direct','briefing'));

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
  where r.school_id=p_school and extract(dow from j.day)=h.weekday;
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
  join public.school_recruitment r on r.school_id=p_school
  where public.class_briefing_available(p_school,o.starts_at,o.duration_minutes,r.booking_weeks,o.id)
    and (select count(*) from public.school_admission_cases c where c.intake_slot_id=o.id and c.decision<>'withdrawn') < o.capacity
  order by o.starts_at,o.channel,o.id;
$$;

create function public.book_school_offer_intake(p_public uuid,p_slot uuid,p_name text,p_applicant text,p_email text,p_agreement text,p_phone text,p_offer uuid)
returns table(case_id uuid, starts_at timestamptz, school_name text, kind text)
language plpgsql set search_path = '' as $$
declare
  r public.school_recruitment%rowtype;
  slot public.school_recruitment_slots%rowtype;
  school public.class_schools%rowtype;
  candidate uuid;
  generated_slot record;
begin
  select * into strict r from public.school_recruitment where public_id=p_public and enabled for no key update;
  if not exists(select 1 from public.school_recruitment_offers o where o.id=p_offer and o.school_id=r.school_id
    and o.enabled and coalesce(o.route_override,r.route)='briefing') then raise no_data_found; end if;
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

revoke all on function public.book_school_offer_intake(uuid,uuid,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.book_school_offer_intake(uuid,uuid,text,text,text,text,text,uuid) to service_role;

create or replace function public.submit_school_offer(
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
  if coalesce(offer.route_override,recruitment.route)='briefing' then
    select * into strict booked from public.book_school_offer_intake(p_public,p_slot,p_name,p_applicant,p_email,recruitment.information,p_phone,p_offer);
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
