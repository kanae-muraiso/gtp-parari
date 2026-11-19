create or replace function public.complete_direct_class_admission(p_owner uuid,p_school uuid,p_case uuid,p_start date,p_receipt boolean,p_auto boolean)
returns void language plpgsql set search_path='' as $$
declare
  c public.school_admission_cases%rowtype;
  plan jsonb;
  seats integer;
begin
  perform 1 from public.class_schools where id=p_school and owner_user_id=p_owner and archived_at is null for update;
  if not found then raise no_data_found; end if;
  select * into strict c from public.school_admission_cases where id=p_case and school_id=p_school for update;
  if c.enrollment_id is not null then return; end if;
  if c.source <> 'public' or c.applicant_audience is null or c.test not in ('skip','graded')
    or not (
      (c.briefing = 'skip' and c.test='skip' and c.invite_token is null and c.briefing_followup is null
        and c.decision in ('pending','approved') and (not p_auto or c.direct_completion is not distinct from 'automatic'))
      or (not p_auto and c.briefing='done' and c.decision='approved' and coalesce(c.briefing_followup ? 'expiresAt',false)
        and c.consent_at is not null and c.applicant_user_id is not null)
    ) then raise invalid_parameter_value; end if;
  if p_start is null then raise invalid_parameter_value; end if;
  if c.requested_class_id is not null then
    plan := public.class_product_for_slot(p_school,c.requested_class_id);
    if plan->>'booking' in ('fixed','multiple') then
      seats := public.class_fixed_seat_count(p_school,c.requested_class_id);
      if seats >= (plan->>'capacity')::integer or exists (
        select 1 from public.school_class_visit_reservations r
        where r.class_id=c.requested_class_id and r.visit_on>=p_start
        group by r.visit_on having count(*)+seats >= (plan->>'capacity')::integer
      ) then raise exception 'class full' using errcode='P0001'; end if;
    end if;
  end if;
  update public.school_admission_cases set decision='approved',starts_on=p_start,
    received_at=case when p_receipt and not p_auto and c.payment='advance' then now() else received_at end
    where id=p_case;
  perform public.finish_class_admission(p_owner,p_school,p_case);
end;
$$;
