-- A verified primary applicant retains access even when an older form has no audience/guardian fields.
-- Use the same case relationship for calendars, HOME and event notices; do not infer or rewrite historical audience.
create or replace function public.class_member_access(p_actor uuid,p_school uuid,p_member uuid)
returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from public.school_enrollments e join public.class_schools s on s.id=e.school_id
    where e.id=p_member and e.school_id=p_school and e.status='active' and s.archived_at is null and
    (e.user_id=p_actor or exists(select 1 from public.school_admission_cases c where c.school_id=e.school_id
      and c.enrollment_id=e.id and c.applicant_user_id=p_actor and c.consent_at is not null)));
$$;
create or replace function public.class_participant_members(p_actor uuid,p_school uuid)
returns jsonb language sql stable set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,
    'role',case when e.user_id=p_actor then 'learner' when exists(select 1 from public.school_admission_cases c
      where c.school_id=e.school_id and c.enrollment_id=e.id and c.applicant_user_id=p_actor
      and (c.applicant_audience='minor' or c.application_fields ? 'guardianEmail' or c.briefing_followup #>> '{design,audience}'='minor')) then 'guardian' else 'learner' end,
    'startsOn',(select min(c.starts_on) from public.school_admission_cases c where c.enrollment_id=e.id and c.school_id=e.school_id))
    order by e.name,e.id),'[]'::jsonb) from public.school_enrollments e
    where e.school_id=p_school and public.class_member_access(p_actor,p_school,e.id);
$$;

create or replace function public.class_event_member(p_school uuid, p_classes jsonb, p_user uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.school_enrollments e
    where e.school_id = p_school and e.status = 'active'
    and public.class_member_access(p_user,p_school,e.id)
    and (p_classes = '[]'::jsonb or exists (
      select 1 from public.school_class_assignments a
      where a.school_id = p_school and a.enrollment_id = e.id and p_classes ? a.class_id::text
    ))
  );
$$;
