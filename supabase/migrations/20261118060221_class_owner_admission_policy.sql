-- Teacher-defined audience; NULL preserves legacy briefing-design settings.
alter table public.school_recruitment add column audience text check (audience in ('adult','minor'));
alter table public.school_recruitment_offers add column audience_override text check (audience_override in ('adult','minor'));

-- Save the common settings and, only on an explicit bulk action, reset all class policies atomically.
create function public.save_class_intake_settings(p_owner uuid,p_school uuid,p_settings jsonb,p_all boolean)
returns void language plpgsql set search_path='' as $$
begin
  perform 1 from public.class_schools where id=p_school and owner_user_id=p_owner and archived_at is null for update;
  if not found then raise no_data_found; end if;
  if jsonb_typeof(p_settings) is distinct from 'object' or
    coalesce(p_settings->>'route','') not in ('direct','briefing') or coalesce(p_settings->>'audience','') not in ('adult','minor')
    then raise invalid_parameter_value; end if;
  insert into public.school_recruitment as existing
    (school_id,information,kind,route,audience,booking_weeks,show_class_schedule,application_text,payment_mode,payment_url,arrival_text,confirmation_text)
  values(p_school,p_settings->>'information',p_settings->>'kind',p_settings->>'route',p_settings->>'audience',
    (p_settings->>'booking_weeks')::integer,coalesce((p_settings->>'show_class_schedule')::boolean,true),
    p_settings->>'application_text',p_settings->>'payment_mode',p_settings->>'payment_url',p_settings->>'arrival_text',p_settings->>'confirmation_text')
  on conflict(school_id) do update set information=excluded.information,kind=excluded.kind,route=excluded.route,audience=excluded.audience,
    booking_weeks=excluded.booking_weeks,show_class_schedule=coalesce((p_settings->>'show_class_schedule')::boolean,existing.show_class_schedule),
    application_text=excluded.application_text,payment_mode=excluded.payment_mode,payment_url=excluded.payment_url,
    arrival_text=excluded.arrival_text,confirmation_text=excluded.confirmation_text;
  if p_all then
    update public.school_recruitment_offers set route_override=null,audience_override=null where school_id=p_school;
  end if;
end;
$$;
revoke all on function public.save_class_intake_settings(uuid,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.save_class_intake_settings(uuid,uuid,jsonb,boolean) to service_role;

create or replace function public.submit_school_intake_profile(
  p_public uuid,p_offer uuid,p_class uuid,p_slot uuid,p_audience text,p_fields jsonb,p_information text,p_terms text
) returns table(case_id uuid,starts_at timestamptz,school_name text,kind text)
language plpgsql set search_path='' as $$
declare
  r public.school_recruitment%rowtype;
  candidate public.school_admission_cases%rowtype;
  booked record;
  cid uuid;
  contact text;
  applicant text;
  phone text;
  field text;
  effective_route text;
  configured_audience text;
  offer_information text;
begin
  if p_audience is null or p_audience not in ('adult','minor') or jsonb_typeof(p_fields) is distinct from 'object' then raise invalid_parameter_value; end if;
  foreach field in array array['name','email'] || case when p_audience='minor' then
    array['guardianName','guardianEmail','guardianPhone','guardianAddress'] else array[]::text[] end loop
    if jsonb_typeof(p_fields->field) is distinct from 'string' or length(btrim(p_fields->>field))=0 then raise invalid_parameter_value; end if;
  end loop;
  for field in select jsonb_object_keys(p_fields) loop
    if field not in ('name','email','phone','address','school','guardianName','guardianEmail','guardianPhone','guardianAddress')
      or jsonb_typeof(p_fields->field) is distinct from 'string' or length(p_fields->>field)>300 then raise invalid_parameter_value; end if;
  end loop;
  if length(p_fields->>'name')>120 or length(p_fields->>'guardianName')>120 or
    length(p_fields->>'email')>254 or (p_fields->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or
    (p_audience='minor' and (length(p_fields->>'guardianEmail')>254 or (p_fields->>'guardianEmail') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) or
    (coalesce(p_fields->>'phone','')<>'' and (p_fields->>'phone') !~ '^[+0-9()[:space:]-]{7,30}$') or
    (p_audience='minor' and (p_fields->>'guardianPhone') !~ '^[+0-9()[:space:]-]{7,30}$') then raise invalid_parameter_value; end if;
  contact := lower(case when p_audience='minor' then p_fields->>'guardianEmail' else p_fields->>'email' end);
  applicant := case when p_audience='minor' then p_fields->>'guardianName' else p_fields->>'name' end;
  phone := case when p_audience='minor' then p_fields->>'guardianPhone' else p_fields->>'phone' end;
  select * into strict r from public.school_recruitment where public_id=p_public and enabled for update;
  select coalesce(r.audience,settings.briefing_design->>'audience','adult') into configured_audience
    from (select 1) base left join public.school_admission_settings settings on settings.school_id=r.school_id;
  if p_offer is not null then
    select coalesce(o.audience_override,configured_audience),o.information into strict configured_audience,offer_information
      from public.school_recruitment_offers o where o.id=p_offer and o.school_id=r.school_id and o.enabled;
  end if;
  if p_audience is distinct from configured_audience then raise invalid_parameter_value; end if;
  if p_offer is not null and coalesce(nullif(btrim(offer_information),''),r.information) is distinct from p_information
    then raise invalid_parameter_value; end if;
  effective_route := r.route;
  if p_offer is not null then
    select coalesce(o.route_override,r.route) into strict effective_route from public.school_recruitment_offers o
      where o.id=p_offer and o.school_id=r.school_id and o.enabled;
    select * into strict booked from public.submit_school_offer(p_public,p_offer,p_class,p_slot,p_fields->>'name',applicant,contact,offer_information,p_terms,phone);
    cid := booked.case_id;
  elsif effective_route='direct' then
    cid := public.submit_direct_class_application(p_public,p_fields->>'name',applicant,contact,p_information,p_terms);
  else
    select * into strict booked from public.book_school_intake(p_public,p_slot,p_fields->>'name',applicant,contact,p_information,phone);
    cid := booked.case_id;
  end if;
  select * into strict candidate from public.school_admission_cases where id=cid and school_id=r.school_id for update;
  -- Retries cannot replace another applicant's saved identity or change adult/minor status.
  if candidate.applicant_audience is not null and
    (candidate.applicant_audience is distinct from p_audience or candidate.application_fields is distinct from p_fields)
    or candidate.applicant_audience is null and (candidate.enrollment_id is not null or candidate.invite_token is not null or candidate.applicant_user_id is not null)
    then raise invalid_parameter_value; end if;
  update public.school_admission_cases set applicant_audience=p_audience,application_fields=p_fields,
    intake_agreement=case when candidate.applicant_audience is null then p_information else intake_agreement end,
    learner_email=case when p_audience='minor' then lower(p_fields->>'email') end,applicant_phone=nullif(phone,'') where id=cid;
  return query select cid,case when effective_route='briefing' then candidate.briefing_at else null end,s.name,r.kind
    from public.class_schools s where s.id=r.school_id;
end;
$$;
