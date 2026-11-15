alter table public.school_recruitment add column booking_weeks integer not null default 4
  check (booking_weeks between 1 and 4);

create table public.school_recruitment_blocks (
  id uuid primary key,
  school_id uuid not null references public.school_recruitment(school_id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  check (ends_at > starts_at)
);
create index school_recruitment_blocks_school_start on public.school_recruitment_blocks(school_id,starts_at);
alter table public.school_recruitment_blocks enable row level security;
revoke all on public.school_recruitment_blocks from public, anon, authenticated;
grant select, insert, delete on public.school_recruitment_blocks to service_role;

create function public.lock_class_recruitment_block()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform 1 from public.school_recruitment where school_id=old.school_id for no key update;
    return old;
  end if;
  perform 1 from public.school_recruitment where school_id=new.school_id for no key update;
  return new;
end;
$$;
revoke all on function public.lock_class_recruitment_block() from public, anon, authenticated;
create trigger serialize_class_recruitment_block
before insert or delete on public.school_recruitment_blocks
for each row execute function public.lock_class_recruitment_block();

create function public.class_slot_in_booking_window(p_school uuid,p_start timestamptz,p_duration integer,p_weeks integer)
returns boolean language sql stable set search_path = '' as $$
  select p_start > now()
    and (p_start at time zone 'Asia/Tokyo')::date <= (now() at time zone 'Asia/Tokyo')::date + p_weeks * 7
    and not exists (
      select 1 from public.school_recruitment_blocks b
      where b.school_id=p_school and b.starts_at < p_start + make_interval(mins => p_duration) and b.ends_at > p_start
    );
$$;
revoke all on function public.class_slot_in_booking_window(uuid,timestamptz,integer,integer) from public, anon, authenticated;
grant execute on function public.class_slot_in_booking_window(uuid,timestamptz,integer,integer) to service_role;

create function public.available_class_recruitment_slots(p_school uuid)
returns table(id uuid,starts_at timestamptz)
language sql stable set search_path = '' as $$
  select s.id,s.starts_at
  from public.school_recruitment_slots s join public.school_recruitment r using(school_id)
  where s.school_id=p_school and r.route='briefing' and not s.closed
    and public.class_slot_in_booking_window(s.school_id,s.starts_at,s.duration_minutes,r.booking_weeks)
    and (select count(*) from public.school_admission_cases c where c.intake_slot_id=s.id and c.decision<>'withdrawn') < s.capacity
  order by s.starts_at,s.id;
$$;
revoke all on function public.available_class_recruitment_slots(uuid) from public, anon, authenticated;
grant execute on function public.available_class_recruitment_slots(uuid) to service_role;

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
    if not public.class_slot_in_booking_window(r.school_id,slot.starts_at,slot.duration_minutes,r.booking_weeks) then
      raise exception 'slot unavailable' using errcode='P0001';
    end if;
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
