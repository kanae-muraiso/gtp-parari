create or replace function public.save_school_class(
  p_owner uuid, p_school uuid, p_class uuid, p_new boolean, p_school_name text, p_class_name text,
  p_starts_on date, p_starts_at time, p_cadence text, p_location text, p_delivery text, p_meeting_url text, p_duration integer
) returns uuid language plpgsql set search_path='' as $$
begin
  if p_school is null then
    if not p_new then raise no_data_found; end if;
    insert into public.class_schools(owner_user_id,name) values(p_owner,p_school_name) returning id into p_school;
  else
    perform 1 from public.class_schools
    where id=p_school and owner_user_id=p_owner and tier='a' and archived_at is null for no key update;
    if not found then raise no_data_found; end if;
  end if;
  perform 1 from public.school_recruitment where school_id=p_school for no key update;
  if p_new then
    if exists(select 1 from public.school_classes where id=p_class and school_id<>p_school) then raise no_data_found; end if;
    insert into public.school_classes(id,school_id,name,starts_on,starts_at,cadence,location,delivery,meeting_url,duration_minutes)
    values(p_class,p_school,p_class_name,p_starts_on,p_starts_at,p_cadence,p_location,p_delivery,p_meeting_url,p_duration)
    on conflict(id) do nothing;
  else
    update public.school_classes set name=p_class_name,starts_on=p_starts_on,starts_at=p_starts_at,cadence=p_cadence,
      location=p_location,delivery=p_delivery,meeting_url=p_meeting_url,duration_minutes=p_duration
    where id=p_class and school_id=p_school;
    if not found then raise no_data_found; end if;
  end if;
  return p_class;
end;
$$;
