create table public.class_schools (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  tier text not null default 'a' check (tier = 'a'),
  unique (owner_user_id, tier)
);

create table public.school_classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.class_schools(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  starts_on date not null,
  starts_at time not null,
  cadence text not null check (cadence in ('weekly', 'monthly')),
  location text check (char_length(location) <= 200),
  unique (school_id, id)
);

create table public.school_enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.class_schools(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'ended')),
  participation_mode text not null default 'assigned' check (participation_mode in ('assigned', 'open')),
  joined_at timestamptz not null default now(),
  unique (school_id, user_id),
  unique (school_id, id)
);
create index school_enrollments_user_idx on public.school_enrollments (user_id) where status = 'active';

create table public.school_class_assignments (
  school_id uuid not null,
  enrollment_id uuid not null,
  class_id uuid not null,
  primary key (school_id, enrollment_id, class_id),
  foreign key (school_id, enrollment_id) references public.school_enrollments(school_id, id) on delete cascade,
  foreign key (school_id, class_id) references public.school_classes(school_id, id) on delete cascade
);
create index school_class_assignments_class_idx on public.school_class_assignments (school_id, class_id);

create table public.school_admission_applications (
  application_id uuid primary key references public.applications(id) on delete cascade,
  school_id uuid not null unique,
  class_id uuid not null,
  foreign key (school_id, class_id) references public.school_classes(school_id, id) on delete cascade
);

alter table public.class_schools enable row level security;
alter table public.school_classes enable row level security;
alter table public.school_enrollments enable row level security;
alter table public.school_class_assignments enable row level security;
alter table public.school_admission_applications enable row level security;

revoke all on public.class_schools, public.school_classes, public.school_enrollments,
  public.school_class_assignments, public.school_admission_applications from public, anon, authenticated;
grant select, insert, update, delete on public.class_schools, public.school_classes, public.school_enrollments,
  public.school_class_assignments, public.school_admission_applications to service_role;

create function public.create_class_a(
  p_owner uuid, p_school_name text, p_class_name text, p_starts_on date,
  p_starts_at time, p_cadence text, p_location text
) returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_school uuid;
begin
  insert into public.class_schools (owner_user_id, name) values (p_owner, p_school_name) returning id into v_school;
  insert into public.school_classes (school_id, name, starts_on, starts_at, cadence, location)
  values (v_school, p_class_name, p_starts_on, p_starts_at, p_cadence, p_location);
  return v_school;
end;
$$;

create function public.add_class_a_member(
  p_owner uuid, p_school uuid, p_member uuid, p_name text, p_user uuid
) returns void
language plpgsql set search_path = ''
as $$
declare
  v_class uuid;
  v_member uuid;
begin
  select c.id into strict v_class
  from public.school_classes c
  join public.class_schools s on s.id = c.school_id
  where s.id = p_school and s.owner_user_id = p_owner and s.tier = 'a';

  if p_user is null then
    insert into public.school_enrollments (id, school_id, name) values (p_member, p_school, p_name)
    on conflict (id) do nothing
    returning id into v_member;
  else
    insert into public.school_enrollments (id, school_id, name, user_id) values (p_member, p_school, p_name, p_user)
    on conflict (school_id, user_id) do update set status = 'active'
    returning id into v_member;
  end if;

  if v_member is not null then
    insert into public.school_class_assignments (school_id, enrollment_id, class_id)
    values (p_school, v_member, v_class) on conflict do nothing;
  end if;
end;
$$;

-- An individual admission is applied once through the existing confirmation path.
-- A previously ended enrollment can be reopened by the operator from the roster.
create function public.apply_school_admission(p_application uuid, p_user uuid, p_name text)
returns void
language sql set search_path = ''
as $$
  with destination as (
    select school_id, class_id from public.school_admission_applications where application_id = p_application
  ), enrolled as (
    insert into public.school_enrollments (school_id, user_id, name)
    select d.school_id, p_user,
      left(coalesce(nullif(btrim(p_name), ''), nullif(btrim(p.display_name), ''), nullif(p.username, ''), '受講者'), 120)
    from destination d
    left join public.profiles p on p.user_id = p_user
    where p_user is not null
    on conflict (school_id, user_id) do nothing
    returning school_id, id
  )
  insert into public.school_class_assignments (school_id, enrollment_id, class_id)
  select e.school_id, e.id, d.class_id from enrolled e join destination d using (school_id)
  on conflict do nothing;
$$;

create function public.sync_school_admission()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status <> 'confirmed' or new.user_id is null or new.calendar_occurrence_id is not null
      or new.calendar_recurring_booking_id is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'confirmed' and old.user_id = new.user_id then
    return new;
  end if;

  -- Serialize confirmations with linking and unlinking the admission form.
  perform 1 from public.applications where id = new.application_id and application_type = 'SCHOOL'
    and origin = 'manual' and calendar_item_id is null for no key update;
  if found then
    perform public.apply_school_admission(new.application_id, new.user_id, new.applicant_name);
  end if;
  return new;
end;
$$;

create trigger sync_school_admission after insert or update of status, user_id on public.application_entries
for each row execute function public.sync_school_admission();

create function public.set_class_a_admission(p_owner uuid, p_school uuid, p_application uuid)
returns void
language plpgsql set search_path = ''
as $$
declare
  v_class uuid;
  v_previous uuid;
begin
  perform 1 from public.class_schools where id = p_school and owner_user_id = p_owner and tier = 'a' for update;
  if not found then raise no_data_found; end if;
  select id into strict v_class from public.school_classes where school_id = p_school;
  select application_id into v_previous from public.school_admission_applications where school_id = p_school;

  perform 1 from public.applications where id in (v_previous, p_application) order by id for no key update;
  if p_application is not null and not exists (
    select 1 from public.applications
    where id = p_application and owner_user_id = p_owner and application_type = 'SCHOOL'
      and origin = 'manual' and calendar_item_id is null and archived_at is null
  ) then raise no_data_found; end if;

  if v_previous is not distinct from p_application then return; end if;
  delete from public.school_admission_applications where school_id = p_school;
  if p_application is null then return; end if;

  insert into public.school_admission_applications (application_id, school_id, class_id)
  values (p_application, p_school, v_class);

  -- Include completed admissions from before the operator linked the form.
  perform public.apply_school_admission(p_application, entry.user_id, entry.applicant_name)
  from (
    select distinct on (user_id) user_id, applicant_name
    from public.application_entries
    where application_id = p_application and status = 'confirmed' and user_id is not null
      and calendar_occurrence_id is null and calendar_recurring_booking_id is null
    order by user_id, created_at, id
  ) entry;
end;
$$;

revoke all on function public.create_class_a(uuid, text, text, date, time, text, text),
  public.add_class_a_member(uuid, uuid, uuid, text, uuid),
  public.set_class_a_admission(uuid, uuid, uuid),
  public.apply_school_admission(uuid, uuid, text),
  public.sync_school_admission() from public, anon, authenticated;
grant execute on function public.create_class_a(uuid, text, text, date, time, text, text),
  public.add_class_a_member(uuid, uuid, uuid, text, uuid),
  public.set_class_a_admission(uuid, uuid, uuid),
  public.apply_school_admission(uuid, uuid, text),
  public.sync_school_admission() to service_role;

create function public.update_class_a_schedule(
  p_owner uuid, p_school uuid, p_school_name text, p_class_name text, p_starts_on date,
  p_starts_at time, p_cadence text, p_location text
) returns void
language plpgsql set search_path = ''
as $$
begin
  update public.class_schools set name = p_school_name
  where id = p_school and owner_user_id = p_owner and tier = 'a';
  if not found then raise no_data_found; end if;
  update public.school_classes
  set name = p_class_name, starts_on = p_starts_on, starts_at = p_starts_at, cadence = p_cadence, location = p_location
  where school_id = p_school;
end;
$$;

revoke all on function public.update_class_a_schedule(uuid, uuid, text, text, date, time, text, text)
from public, anon, authenticated;
grant execute on function public.update_class_a_schedule(uuid, uuid, text, text, date, time, text, text)
to service_role;

create function public.read_class_school(p_school uuid, p_user uuid)
returns jsonb
language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id, 'name', s.name,
    'classes', coalesce((
      select jsonb_agg(to_jsonb(c) - 'school_id' order by c.name, c.id)
      from public.school_classes c
      where c.school_id = s.id and (
        s.owner_user_id = p_user or e.participation_mode = 'open' or exists (
          select 1 from public.school_class_assignments a
          where a.school_id = s.id and a.enrollment_id = e.id and a.class_id = c.id
        )
      )
    ), '[]'::jsonb)
  )
  from public.class_schools s
  left join public.school_enrollments e on e.school_id = s.id and e.user_id = p_user and e.status = 'active'
  where s.id = p_school and (s.owner_user_id = p_user or e.id is not null);
$$;

revoke all on function public.read_class_school(uuid, uuid) from public, anon, authenticated;
grant execute on function public.read_class_school(uuid, uuid) to service_role;
