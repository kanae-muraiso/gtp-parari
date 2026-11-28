-- DRAFT ONLY. Separate business membership from service participation.
-- No backfill, no alterations to existing enrollments or event authorization.
-- All access is server-only. The API must authenticate p_owner/p_user before
-- invoking a function; no client-controlled actor identifiers are trusted.
begin;
create table public.class_business_membership_settings (
 school_id uuid primary key references public.class_schools(id) on delete restrict,
 enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
create table public.class_business_members (
 school_id uuid not null references public.class_schools(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 status text not null check(status in ('pending','active','ended')),
 approved_at timestamptz,
 ended_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(school_id,user_id),
 check(status <> 'active' or approved_at is not null)
);
-- These are service-specific DRAFT settings, not current public permissions,
-- not proof of payment, and not a participant/enrollment record.
create table public.class_service_intake_designs (
 school_id uuid not null references public.class_schools(id) on delete restrict,
 service_kind text not null check(service_kind in ('course','workshop','event')),
 service_id uuid not null,
 audience text not null check(audience in ('everyone','members_only')),
 entry_route text not null check(entry_route in ('direct','briefing')),
 confirmation text not null check(confirmation in ('review','automatic')),
 terms text not null default '' check(char_length(terms)<=8000),
 payment_timing text not null check(payment_timing in ('free','before','onsite','recurring')),
 updated_at timestamptz not null default now(),
 primary key(school_id,service_kind,service_id),
 check(payment_timing <> 'recurring' or service_kind='course')
);
alter table public.class_business_membership_settings enable row level security;
alter table public.class_business_members enable row level security;
alter table public.class_service_intake_designs enable row level security;
revoke all on public.class_business_membership_settings, public.class_business_members, public.class_service_intake_designs from public, anon, authenticated, service_role;
grant select on public.class_business_membership_settings, public.class_business_members, public.class_service_intake_designs to service_role;

create function public.class_participation_service_exists(p_school uuid,p_kind text,p_service uuid)
returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.class_schools s where s.id=p_school and s.archived_at is null)
 and case when p_kind='course' then exists(select 1 from public.school_class_products p where p.school_id=p_school and p.id=p_service)
 when p_kind in ('event','workshop') then exists(select 1 from public.applications a join public.class_schools s on s.id=a.class_event_school_id
 where a.id=p_service and a.class_event_school_id=p_school and a.owner_user_id=s.owner_user_id and a.archived_at is null and a.class_event is not null
 and (case when p_kind='workshop' then jsonb_typeof(a.class_event->'sessions')='array' else not (a.class_event ? 'sessions') or a.class_event->'sessions'='null'::jsonb end))
 else false end
$$;
revoke all on function public.class_participation_service_exists(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.class_participation_service_exists(uuid,text,uuid) to service_role;

create function public.set_class_business_membership_enabled(p_school uuid,p_owner uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_enabled is null or not exists(select 1 from public.class_schools s where s.id=p_school and s.owner_user_id=p_owner and s.archived_at is null) then raise exception 'Invalid business owner' using errcode='42501'; end if;
 -- Serialize all policy/membership writes for the same business.
 perform pg_advisory_xact_lock(hashtextextended('class-participation:'||p_school::text,0));
 if not p_enabled and (exists(select 1 from public.class_business_members where school_id=p_school and status in ('active','pending')) or exists(select 1 from public.class_service_intake_designs where school_id=p_school and audience='members_only')) then
 raise exception 'Resolve existing membership records and member-only designs before disabling' using errcode='23514'; end if;
 insert into public.class_business_membership_settings(school_id,enabled) values(p_school,p_enabled)
 on conflict(school_id) do update set enabled=excluded.enabled,updated_at=now();
end $$;

create function public.set_class_business_member(p_school uuid,p_owner uuid,p_user uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.class_schools s where s.id=p_school and s.owner_user_id=p_owner and s.archived_at is null) then raise exception 'Invalid business owner' using errcode='42501'; end if;
 if p_user is null or p_status is null or p_status not in ('pending','active','ended') then raise exception 'Invalid membership status' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('class-participation:'||p_school::text,0));
 if p_status<>'ended' and not exists(select 1 from public.class_business_membership_settings where school_id=p_school and enabled) then raise exception 'Membership not enabled' using errcode='23514'; end if;
 insert into public.class_business_members(school_id,user_id,status,approved_at,ended_at)
 values(p_school,p_user,p_status,case when p_status='active' then now() end,case when p_status='ended' then now() end)
 on conflict(school_id,user_id) do update set status=excluded.status,
 approved_at=case when excluded.status='active' then coalesce(public.class_business_members.approved_at,now()) else public.class_business_members.approved_at end,
 ended_at=case when excluded.status='ended' then coalesce(public.class_business_members.ended_at,now()) else null end,updated_at=now();
 -- Never create, cancel or modify a course contract or event entry here.
end $$;

create function public.save_class_service_intake_design(p_school uuid,p_owner uuid,p_kind text,p_service uuid,p_audience text,p_route text,p_confirmation text,p_terms text,p_payment text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.class_schools s where s.id=p_school and s.owner_user_id=p_owner and s.archived_at is null) then raise exception 'Invalid business owner' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('class-participation:'||p_school::text,0));
 if not public.class_participation_service_exists(p_school,p_kind,p_service) then raise exception 'Invalid scoped service' using errcode='22023'; end if;
 if p_audience='members_only' and not exists(select 1 from public.class_business_membership_settings where school_id=p_school and enabled) then raise exception 'Membership not enabled' using errcode='23514'; end if;
 insert into public.class_service_intake_designs(school_id,service_kind,service_id,audience,entry_route,confirmation,terms,payment_timing)
 values(p_school,p_kind,p_service,p_audience,p_route,p_confirmation,p_terms,p_payment)
 on conflict(school_id,service_kind,service_id) do update set audience=excluded.audience,entry_route=excluded.entry_route,confirmation=excluded.confirmation,terms=excluded.terms,payment_timing=excluded.payment_timing,updated_at=now();
end $$;

-- Preview evaluation of draft audience only. Never use this function as
-- authorization to actually register, charge, enroll or publish a service.
create function public.class_service_draft_audience_matches(p_school uuid,p_kind text,p_service uuid,p_user uuid)
returns boolean language sql stable set search_path='' as $$
 select coalesce((select public.class_participation_service_exists(p_school,p_kind,p_service)
 and (d.audience='everyone' or (d.audience='members_only' and exists(
 select 1 from public.class_business_membership_settings b join public.class_business_members m using(school_id)
 where b.school_id=p_school and b.enabled and m.user_id=p_user and m.status='active')))
 from public.class_service_intake_designs d where d.school_id=p_school and d.service_kind=p_kind and d.service_id=p_service),false)
$$;
revoke all on function public.set_class_business_membership_enabled(uuid,uuid,boolean),public.set_class_business_member(uuid,uuid,uuid,text),public.save_class_service_intake_design(uuid,uuid,text,uuid,text,text,text,text,text),public.class_service_draft_audience_matches(uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.set_class_business_membership_enabled(uuid,uuid,boolean),public.set_class_business_member(uuid,uuid,uuid,text),public.save_class_service_intake_design(uuid,uuid,text,uuid,text,text,text,text,text),public.class_service_draft_audience_matches(uuid,text,uuid,uuid) to service_role;
commit;
