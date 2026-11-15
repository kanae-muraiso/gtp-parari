alter table public.school_recruitment
  add column route text not null default 'briefing' check (route in ('briefing','direct')),
  add column application_text text not null default '',
  add column payment_mode text not null default 'free' check (payment_mode in ('free','onsite','advance')),
  add column payment_url text,
  add column arrival_text text not null default '',
  add column confirmation_text text not null default '';
alter table public.school_recruitment_slots
  add column location text,
  add column duration_minutes integer not null default 60 check (duration_minutes between 5 and 480);

create unique index school_direct_application_unique
  on public.school_admission_cases (school_id, applicant_email, name)
  where source='public' and intake_slot_id is null and applicant_email is not null and decision <> 'withdrawn';

create function public.submit_direct_class_application(
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
    and intake_slot_id is null and decision <> 'withdrawn';
  if result_id is not null then return result_id; end if;
  insert into public.school_admission_cases
    (id,school_id,name,contact,source,briefing,test,decision,payment,applicant_email,applicant_name,intake_agreement,consent_at,agreed_terms)
  values(gen_random_uuid(),r.school_id,p_name,p_email,'public','skip','skip','pending',r.payment_mode,p_email,p_applicant,p_information,now(),p_terms)
  returning id into result_id;
  return result_id;
end;
$$;
revoke all on function public.submit_direct_class_application(uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_direct_class_application(uuid,text,text,text,text,text) to service_role;

create or replace function public.book_school_intake(p_public uuid,p_slot uuid,p_name text,p_applicant text,p_email text,p_agreement text)
returns table(case_id uuid, starts_at timestamptz, school_name text, kind text)
language plpgsql set search_path = '' as $$
declare
  r public.school_recruitment%rowtype;
  slot public.school_recruitment_slots%rowtype;
  school public.class_schools%rowtype;
  candidate uuid;
begin
  select * into strict r from public.school_recruitment where public_id=p_public and enabled and route='briefing' for share;
  select * into strict school from public.class_schools where id=r.school_id;
  if not exists(select 1 from public.profiles where user_id=school.owner_user_id and is_monitor) then raise no_data_found; end if;
  select * into strict slot from public.school_recruitment_slots where id=p_slot and school_id=r.school_id and not closed and school_recruitment_slots.starts_at>now() for update;
  if r.information is distinct from p_agreement then raise invalid_parameter_value; end if;
  select id into candidate from public.school_admission_cases
    where intake_slot_id=p_slot and applicant_email=p_email and name=p_name and decision<>'withdrawn';
  if candidate is null then
    if (select count(*) from public.school_admission_cases where intake_slot_id=p_slot and decision<>'withdrawn') >= slot.capacity then
      raise exception 'slot full' using errcode='P0001';
    end if;
    candidate := gen_random_uuid();
    insert into public.school_admission_cases
      (id,school_id,name,contact,source,briefing,briefing_at,test,decision,payment,intake_slot_id,applicant_email,applicant_name,intake_agreement)
    values(candidate,r.school_id,p_name,p_email,'public','booked',slot.starts_at,
      case when exists(select 1 from public.school_admission_settings where school_id=r.school_id and test) then 'pending' else 'skip' end,
      'pending','free',p_slot,p_email,p_applicant,p_agreement);
  end if;
  return query select candidate, slot.starts_at, school.name, r.kind;
end;
$$;
