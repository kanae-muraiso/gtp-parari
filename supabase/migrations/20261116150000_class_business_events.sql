alter table public.applications
  add column class_event_school_id uuid references public.class_schools(id),
  add column class_event jsonb,
  add constraint applications_class_event_pair check (
    (class_event_school_id is null) = (class_event is null)
  );

create index applications_class_event_school_idx on public.applications(class_event_school_id)
  where class_event_school_id is not null;

alter table public.application_entries
  add column class_event_attendance text check (class_event_attendance in ('present','absent'));

create unique index application_entries_class_event_staff_enrollment_uidx
  on public.application_entries (application_id, (application_snapshot ->> 'class_event_enrollment'))
  where application_snapshot ? 'class_event_enrollment' and status in ('submitted','confirmed');

create policy hide_class_events_from_direct_access on public.applications
  as restrictive for all to anon, authenticated
  using (class_event_school_id is null) with check (class_event_school_id is null);

create function public.class_event_member(p_school uuid, p_classes jsonb, p_user uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.school_enrollments e
    where e.school_id = p_school and e.status = 'active'
    and (e.user_id = p_user or exists (
      select 1 from public.school_admission_cases c
      where c.school_id = p_school and c.enrollment_id = e.id and c.applicant_user_id = p_user
      and c.application_fields ? 'guardianEmail'
    ))
    and (p_classes = '[]'::jsonb or exists (
      select 1 from public.school_class_assignments a
      where a.school_id = p_school and a.enrollment_id = e.id and p_classes ? a.class_id::text
    ))
  );
$$;

revoke all on function public.class_event_member(uuid,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.class_event_member(uuid,jsonb,uuid) to service_role;

create function public.check_class_event_entry()
returns trigger language plpgsql set search_path = '' as $$
declare
  event public.applications%rowtype;
  staff boolean;
begin
  select * into event from public.applications where id = new.application_id
    and class_event_school_id is not null for update;
  if not found then return new; end if;

  staff := current_user in ('service_role', 'postgres') and coalesce(new.application_snapshot -> 'class_event_staff' = 'true'::jsonb, false);
  if not exists (select 1 from public.class_schools where id = event.class_event_school_id and archived_at is null)
    or event.archived_at is not null or
    (not staff and (event.status <> 'open' or not (event.class_event ->> 'registration')::boolean
       or (event.class_event ->> 'deadline')::timestamptz <= now()
       or (event.class_event ->> 'audience' = 'members' and
           not public.class_event_member(event.class_event_school_id,event.class_event -> 'classIds',new.user_id)))) then
    raise exception 'class_event_registration_closed' using errcode = 'P0001';
  end if;

  if (event.definition ->> 'capacity')::int <= (
    select count(*) from public.application_entries
    where application_id = event.id and status in ('submitted','confirmed')
  ) then
    raise exception 'application_capacity_reached' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.check_class_event_entry() from public, anon, authenticated;
create trigger class_event_entry_check before insert on public.application_entries
  for each row execute function public.check_class_event_entry();

create function public.close_archived_class_events()
returns trigger language plpgsql set search_path = '' as $$
begin
  update public.applications set status = 'closed'
  where class_event_school_id = new.id and status = 'open';
  return new;
end;
$$;

revoke all on function public.close_archived_class_events() from public, anon, authenticated;
create trigger close_events_on_class_archive after update of archived_at on public.class_schools
  for each row when (old.archived_at is null and new.archived_at is not null)
  execute function public.close_archived_class_events();
