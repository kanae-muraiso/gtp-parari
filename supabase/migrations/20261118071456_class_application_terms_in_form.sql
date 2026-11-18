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
  if p_all then
    update public.school_recruitment_offers set route_override=null where school_id=p_school;
  end if;
end;
$$;

