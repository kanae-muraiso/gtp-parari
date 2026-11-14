create table public.school_recruitment (
  school_id uuid primary key references public.class_schools(id) on delete cascade,
  public_id uuid not null unique default gen_random_uuid(),
  enabled boolean not null default false,
  information text not null check (char_length(information) between 1 and 4000),
  kind text not null check (kind in ('説明会','体験','見学'))
);
create table public.school_recruitment_slots (
  id uuid primary key,
  school_id uuid not null references public.school_recruitment(school_id) on delete cascade,
  starts_at timestamptz not null,
  capacity integer not null check (capacity between 1 and 100),
  closed boolean not null default false,
  unique (school_id, id)
);
alter table public.school_admission_cases
  add column intake_slot_id uuid,
  add column applicant_email text,
  add column applicant_name text,
  add column intake_agreement text,
  add foreign key (school_id, intake_slot_id) references public.school_recruitment_slots(school_id,id);
create index school_cases_intake_slot_idx on public.school_admission_cases(intake_slot_id);
create unique index school_case_intake_unique on public.school_admission_cases(intake_slot_id, applicant_email, name)
  where decision <> 'withdrawn' and intake_slot_id is not null;
alter table public.school_recruitment enable row level security;
alter table public.school_recruitment_slots enable row level security;
revoke all on public.school_recruitment, public.school_recruitment_slots from public, anon, authenticated;
grant select, insert, update on public.school_recruitment, public.school_recruitment_slots to service_role;

create function public.book_school_intake(p_public uuid,p_slot uuid,p_name text,p_applicant text,p_email text,p_agreement text)
returns table(case_id uuid, starts_at timestamptz, school_name text, kind text)
language plpgsql set search_path = '' as $$
declare
  r public.school_recruitment%rowtype;
  slot public.school_recruitment_slots%rowtype;
  school public.class_schools%rowtype;
  candidate uuid;
begin
  select * into strict r from public.school_recruitment where public_id=p_public and enabled for share;
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
revoke all on function public.book_school_intake(uuid,uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.book_school_intake(uuid,uuid,text,text,text,text) to service_role;
