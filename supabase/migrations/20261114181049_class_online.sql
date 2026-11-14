alter table public.school_classes
  add column delivery text not null default 'onsite',
  add column meeting_url text,
  add constraint school_class_delivery check (
    (delivery = 'onsite' and meeting_url is null) or
    (delivery in ('online','hybrid') and meeting_url ~ '^https://' and meeting_url is not null
      and (delivery <> 'hybrid' or nullif(btrim(location),'') is not null))
  );
alter table public.school_recruitment_slots add column meeting_url text
  check (meeting_url is null or meeting_url ~ '^https://');

create function public.save_class_delivery(
  p_owner uuid, p_school uuid, p_school_name text, p_class_name text,
  p_starts_on date, p_starts_at time, p_cadence text, p_location text,
  p_delivery text, p_meeting_url text
) returns void language plpgsql set search_path = '' as $$
begin
  if p_school is null then
    p_school := public.create_class_a(p_owner,p_school_name,p_class_name,p_starts_on,p_starts_at,p_cadence,p_location);
  else
    update public.class_schools set name=p_school_name where id=p_school and owner_user_id=p_owner and tier='a';
    if not found then raise no_data_found; end if;
  end if;
  update public.school_classes set name=p_class_name, starts_on=p_starts_on, starts_at=p_starts_at,
    cadence=p_cadence, location=p_location, delivery=p_delivery, meeting_url=p_meeting_url where school_id=p_school;
end;
$$;
revoke all on function public.save_class_delivery(uuid,uuid,text,text,date,time,text,text,text,text) from public,anon,authenticated;
grant execute on function public.save_class_delivery(uuid,uuid,text,text,date,time,text,text,text,text) to service_role;
