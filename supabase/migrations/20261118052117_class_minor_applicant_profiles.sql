-- New public applicants choose their audience. Legacy cases retain their existing flow.
alter table public.school_admission_cases add column applicant_audience text
  check (applicant_audience in ('adult','minor'));

create function public.submit_school_intake_profile(
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
  effective_route := r.route;
  if p_offer is not null then
    select coalesce(o.route_override,r.route) into strict effective_route from public.school_recruitment_offers o
      where o.id=p_offer and o.school_id=r.school_id and o.enabled;
    select * into strict booked from public.submit_school_offer(p_public,p_offer,p_class,p_slot,p_fields->>'name',applicant,contact,p_information,p_terms,phone);
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
    learner_email=case when p_audience='minor' then lower(p_fields->>'email') end,applicant_phone=nullif(phone,'') where id=cid;
  return query select cid,case when effective_route='briefing' then candidate.briefing_at else null end,s.name,r.kind
    from public.class_schools s where s.id=r.school_id;
end;
$$;
revoke all on function public.submit_school_intake_profile(uuid,uuid,uuid,uuid,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.submit_school_intake_profile(uuid,uuid,uuid,uuid,text,jsonb,text,text) to service_role;

-- Keep auth account lookup behind a narrowly scoped, service-only check.
create function public.verified_class_guardian(p_user uuid,p_email text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from auth.users u where u.id=p_user
    and u.email_confirmed_at is not null and lower(u.email)=lower(p_email));
$$;
revoke all on function public.verified_class_guardian(uuid,text) from public,anon,authenticated;
grant execute on function public.verified_class_guardian(uuid,text) to service_role;

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
  if candidate.applicant_audience='minor' and (candidate.applicant_user_id is null or
    not public.verified_class_guardian(candidate.applicant_user_id,candidate.applicant_email)) then
    raise exception 'guardian account consent required' using errcode='P0006';
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
  if not existed and candidate.requested_class_id is not null then
    update public.school_enrollments e set contract_fee_yen=coalesce(c.fee_override_yen,
      (public.class_product_for_slot(p_school,c.id)->>'monthlyFee')::integer,0)
      from public.school_classes c where e.id=member_id and c.id=candidate.requested_class_id;
  end if;
  update public.school_admission_cases set enrollment_id = member_id, revision = revision + 1
  where id = candidate.id;
end;
$$;
