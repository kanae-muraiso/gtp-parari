create table public.school_admission_settings (
  school_id uuid primary key references public.class_schools(id) on delete cascade,
  labels jsonb not null,
  briefing boolean not null,
  test boolean not null,
  proxy boolean not null,
  terms text not null
);

create table public.school_admission_cases (
  id uuid primary key,
  school_id uuid not null references public.class_schools(id) on delete cascade,
  name text not null,
  contact text not null default '',
  source text not null check (source in ('public', 'referral', 'invite')),
  briefing text not null check (briefing in ('skip', 'pending', 'booked', 'done', 'missed')),
  briefing_at timestamptz,
  test text not null check (test in ('skip', 'pending', 'booked', 'taken', 'graded')),
  test_at timestamptz,
  score text not null default '',
  decision text not null check (decision in ('pending', 'approved', 'held', 'rejected', 'waitlist', 'withdrawn')),
  starts_on date,
  deadline date,
  payment text not null check (payment in ('free', 'advance', 'onsite')),
  received_at timestamptz,
  consent_at timestamptz,
  invite_token uuid unique,
  agreed_terms text,
  enrollment_id uuid references public.school_enrollments(id),
  revision integer not null default 0,
  created_at timestamptz not null default now()
);
create index school_admission_cases_school_idx on public.school_admission_cases(school_id, created_at desc);

alter table public.school_admission_settings enable row level security;
alter table public.school_admission_cases enable row level security;
revoke all on public.school_admission_settings, public.school_admission_cases from public, anon, authenticated;
grant select, insert, update on public.school_admission_settings, public.school_admission_cases to service_role;

create function public.finish_class_admission(p_owner uuid, p_school uuid, p_case uuid)
returns void language plpgsql set search_path = '' as $$
declare
  candidate public.school_admission_cases%rowtype;
  current_terms text;
begin
  select c.* into strict candidate from public.school_admission_cases c
  join public.class_schools s on s.id = c.school_id
  where c.id = p_case and c.school_id = p_school and s.owner_user_id = p_owner for update of c;
  if candidate.enrollment_id is not null then return; end if;
  select terms into current_terms from public.school_admission_settings where school_id = p_school;
  if candidate.decision <> 'approved' or candidate.briefing not in ('skip', 'done') or candidate.test not in ('skip', 'graded')
     or candidate.starts_on is null or candidate.consent_at is null or candidate.agreed_terms is distinct from coalesce(current_terms, '')
     or (candidate.deadline is not null and candidate.deadline < (now() at time zone 'Asia/Tokyo')::date)
     or (candidate.payment = 'advance' and candidate.received_at is null) then
    raise exception 'admission requirements incomplete' using errcode = '22023';
  end if;
  perform public.add_class_a_member(p_owner, p_school, candidate.id, candidate.name, null);
  update public.school_admission_cases set enrollment_id = candidate.id, revision = revision + 1
  where id = candidate.id;
end;
$$;
revoke all on function public.finish_class_admission(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.finish_class_admission(uuid,uuid,uuid) to service_role;
