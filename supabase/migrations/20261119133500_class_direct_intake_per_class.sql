-- The general intake resolves existing applications by class. Match that key,
-- including legacy applications with no selected class.
create unique index school_direct_application_per_class_unique
  on public.school_admission_cases (school_id, applicant_email, name, requested_class_id) nulls not distinct
  where source='public' and intake_slot_id is null and recruitment_offer_id is null
    and applicant_email is not null and decision <> 'withdrawn';
drop index public.school_direct_application_unique;

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
    and intake_slot_id is null and recruitment_offer_id is null and requested_class_id is null and decision <> 'withdrawn';
  if result_id is not null then return result_id; end if;
  insert into public.school_admission_cases
    (id,school_id,name,contact,source,briefing,test,decision,payment,applicant_email,applicant_name,intake_agreement,consent_at,agreed_terms)
  values(gen_random_uuid(),r.school_id,p_name,p_email,'public','skip','skip','pending',r.payment_mode,p_email,p_applicant,p_information,now(),p_terms)
  returning id into result_id;
  return result_id;
end;
$$;
