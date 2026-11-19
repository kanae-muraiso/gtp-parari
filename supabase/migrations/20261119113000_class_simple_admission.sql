alter table public.school_recruitment add column direct_completion text not null default 'review'
  check (direct_completion in ('review','automatic'));
alter table public.school_recruitment_offers add column direct_completion text
  check (direct_completion in ('review','automatic'));
alter table public.school_recruitment_offers add column link_only boolean not null default false
  check (not link_only or (route_override is not distinct from 'direct' and direct_completion is not distinct from 'review'));
alter table public.school_admission_cases add column direct_completion text
  check (direct_completion in ('review','automatic'));

-- Keep application text and terms in the same form/save transaction. Omitted terms preserve legacy clients.
create or replace function public.save_class_intake_settings(p_owner uuid,p_school uuid,p_settings jsonb,p_all boolean)
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
  if p_settings ? 'terms' then
    if jsonb_typeof(p_settings->'terms') is distinct from 'string' or length(p_settings->>'terms')>8000 then raise invalid_parameter_value; end if;
    insert into public.school_admission_settings(school_id,labels,briefing,test,proxy,terms)
      values(p_school,'{"operator":"先生","learner":"生徒","proxy":"保護者","admission":"入会"}'::jsonb,true,false,true,p_settings->>'terms')
      on conflict(school_id) do update set terms=excluded.terms;
  end if;
  if p_settings ? 'direct_completion' then
    update public.school_recruitment set direct_completion=p_settings->>'direct_completion' where school_id=p_school;
  end if;
  if p_all then
    update public.school_recruitment_offers set route_override=null,direct_completion=null where school_id=p_school and not link_only;
  end if;
end;
$$;


-- Capture the policy with the original direct application, before any later settings changes.
create function public.capture_class_direct_completion()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.applicant_audience is null and new.applicant_audience is not null
    and new.source='public' and new.briefing='skip' and new.consent_at is not null then
    select coalesce(o.direct_completion,r.direct_completion) into new.direct_completion
      from public.school_recruitment r left join public.school_recruitment_offers o
        on o.id=new.recruitment_offer_id and o.school_id=r.school_id where r.school_id=new.school_id;
  end if;
  return new;
end;
$$;
revoke all on function public.capture_class_direct_completion() from public,anon,authenticated;
create trigger capture_class_direct_completion before update of applicant_audience on public.school_admission_cases
  for each row execute function public.capture_class_direct_completion();

-- Reuse the normal finalization checks, with approval and enrollment in the same transaction.
create function public.complete_direct_class_admission(p_owner uuid,p_school uuid,p_case uuid,p_start date,p_receipt boolean,p_auto boolean)
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
  if c.source <> 'public' or c.applicant_audience is null or c.briefing <> 'skip'
    or c.test <> 'skip' or c.invite_token is not null or c.briefing_followup is not null
    or c.decision not in ('pending','approved') or (p_auto and c.direct_completion is distinct from 'automatic')
    then raise invalid_parameter_value; end if;
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
revoke all on function public.complete_direct_class_admission(uuid,uuid,uuid,date,boolean,boolean) from public,anon,authenticated;
grant execute on function public.complete_direct_class_admission(uuid,uuid,uuid,date,boolean,boolean) to service_role;

create function public.connect_and_complete_class_registration(p_token uuid,p_user uuid)
returns void language plpgsql set search_path='' as $$
declare
  c public.school_admission_cases%rowtype;
  owner_id uuid;
  first_day date;
  today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  select * into strict c from public.school_admission_cases where registration_token=p_token or learner_token=p_token;
  select owner_user_id into strict owner_id from public.class_schools where id=c.school_id and archived_at is null for update;
  perform public.confirm_class_registration(p_token,p_user);
  select * into strict c from public.school_admission_cases where id=c.id;
  if c.registration_token<>p_token or c.enrollment_id is not null or c.direct_completion is distinct from 'automatic'
    or c.payment='advance' or c.requested_class_id is null or c.decision not in ('pending','approved') then return; end if;
  select today + d.offset_day into first_day
    from public.school_classes lesson cross join generate_series(0,366) as d(offset_day)
    where lesson.id=c.requested_class_id and lesson.school_id=c.school_id
      and public.school_class_runs_on(lesson.id,lesson.starts_on,lesson.cadence,today+d.offset_day)
      and ((today+d.offset_day+lesson.starts_at) at time zone 'Asia/Tokyo')>now()
    order by d.offset_day limit 1;
  if first_day is null then return; end if;
  begin
    perform public.complete_direct_class_admission(owner_id,c.school_id,c.id,first_day,false,true);
  exception when invalid_parameter_value or unique_violation or no_data_found or sqlstate 'P0001' then
    -- Keep the verified application connected for staff to resolve schedule, terms or enrollment conflicts.
    return;
  end;
end;
$$;
revoke all on function public.connect_and_complete_class_registration(uuid,uuid) from public,anon,authenticated;
grant execute on function public.connect_and_complete_class_registration(uuid,uuid) to service_role;
