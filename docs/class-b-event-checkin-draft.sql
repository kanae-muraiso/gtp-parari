-- CLASS B event entrance: draft for isolated verification before rollout.
begin;
create table public.class_event_checkin_gates (
  event_id uuid not null references public.applications(id) on delete cascade,
  session_at timestamptz not null,
  code text not null unique check(code ~ '^[0-9a-f]{16}$'),
  expires_at timestamptz not null,
  primary key(event_id,session_at)
);
create table public.class_event_checkin_receipts (
  entry_id uuid not null references public.application_entries(id) on delete cascade,
  session_at timestamptz not null,
  checked_at timestamptz not null default now(),
  primary key(entry_id,session_at)
);
alter table public.class_event_checkin_gates enable row level security;
alter table public.class_event_checkin_receipts enable row level security;
revoke all on public.class_event_checkin_gates,public.class_event_checkin_receipts from public,anon,authenticated;
grant select,insert,update,delete on public.class_event_checkin_gates to service_role;
grant select,insert on public.class_event_checkin_receipts to service_role;

create function public.set_class_event_gate(p_owner uuid,p_event uuid,p_session timestamptz,p_code text,p_open boolean)
returns text language plpgsql security invoker set search_path='' as $$
declare a public.applications%rowtype;
begin
  select * into a from public.applications where id=p_event and owner_user_id=p_owner
    and class_event_school_id is not null and archived_at is null and status in ('open','closed') for update;
  if not found or not exists(select 1 from public.class_schools where id=a.class_event_school_id
    and owner_user_id=p_owner and archived_at is null) then raise exception 'Event unavailable' using errcode='P0002'; end if;
  if not exists(select 1 from jsonb_array_elements(coalesce(a.class_event->'sessions',jsonb_build_array(a.class_event))) s
      where (s->>'startsAt')::timestamptz=p_session) then raise exception 'Invalid session' using errcode='22023'; end if;
  if not p_open then
    delete from public.class_event_checkin_gates where event_id=p_event and session_at=p_session;
    return null;
  end if;
  if a.class_event->>'registration' is distinct from 'true' then raise exception 'Registration required' using errcode='22023'; end if;
  if now()<p_session-interval '2 hours' or now()>p_session+interval '12 hours' then
    raise exception 'Outside check-in window' using errcode='22023'; end if;
  insert into public.class_event_checkin_gates(event_id,session_at,code,expires_at)
    values(p_event,p_session,p_code,p_session+interval '12 hours')
    on conflict(event_id,session_at) do update set code=excluded.code,expires_at=excluded.expires_at;
  return p_code;
end; $$;
create function public.self_class_event_checkin(p_user uuid,p_code text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare g public.class_event_checkin_gates%rowtype; a public.applications%rowtype;
  e public.application_entries%rowtype; stamp timestamptz; participant text;
begin
  select * into g from public.class_event_checkin_gates where code=p_code and expires_at>now();
  if not found then raise exception 'Check-in closed' using errcode='P0002'; end if;
  select * into a from public.applications where id=g.event_id and archived_at is null
    and status in ('open','closed') for update;
  if not found or not exists(select 1 from public.class_schools where id=a.class_event_school_id and archived_at is null)
    or not exists(select 1 from public.class_event_checkin_gates where code=p_code and expires_at>now())
    then raise exception 'Check-in closed' using errcode='P0002'; end if;
  select * into e from public.application_entries where application_id=a.id and user_id=p_user
    and status='confirmed' and (payment_status='paid' or (a.payment_method='none' and payment_status='not_required'))
    order by id limit 1 for update;
  if not found then raise exception 'Confirmed paid registration required' using errcode='P0001'; end if;
  insert into public.class_event_checkin_receipts(entry_id,session_at) values(e.id,g.session_at)
    on conflict do nothing;
  select checked_at into stamp from public.class_event_checkin_receipts where entry_id=e.id and session_at=g.session_at;
  if a.class_event ? 'sessions' then
    insert into public.class_workshop_attendance(entry_id,session_at,status) values(e.id,g.session_at,'present')
      on conflict(entry_id,session_at) do update set status='present';
  else
    update public.application_entries set class_event_attendance='present'
      where id=e.id;
  end if;
  select coalesce(nullif(e.applicant_name,''),nullif(display_name,''),username,'参加者') into participant
    from public.profiles where user_id=p_user;
  return jsonb_build_object('name',coalesce(participant,nullif(e.applicant_name,''),'参加者'),
    'bookingId',e.id,'checkedAt',stamp,'title',a.title,'sessionAt',g.session_at);
end; $$;
revoke all on function public.set_class_event_gate(uuid,uuid,timestamptz,text,boolean),public.self_class_event_checkin(uuid,text) from public,anon,authenticated;
grant execute on function public.set_class_event_gate(uuid,uuid,timestamptz,text,boolean),public.self_class_event_checkin(uuid,text) to service_role;
-- Staff fallback uses the same paid/confirmed eligibility as self check-in.
-- Absence and corrections can still be recorded for any non-canceled entry.
create function public.staff_class_event_attendance(
 p_owner uuid,p_event uuid,p_entry uuid,p_session timestamptz,p_change text
) returns void language plpgsql security invoker set search_path='' as $$
declare a public.applications%rowtype; e public.application_entries%rowtype;
begin
 if p_change not in ('present','absent','clear') then raise exception 'Invalid attendance' using errcode='22023'; end if;
 select * into a from public.applications where id=p_event and owner_user_id=p_owner
   and class_event_school_id is not null and archived_at is null and status in ('open','closed') for update;
 if not found or not exists(select 1 from public.class_schools where id=a.class_event_school_id
   and owner_user_id=p_owner and archived_at is null) then raise exception 'Event unavailable' using errcode='P0002'; end if;
 if not exists(select 1 from jsonb_array_elements(coalesce(a.class_event->'sessions',jsonb_build_array(a.class_event))) s
   where (s->>'startsAt')::timestamptz=p_session) then raise exception 'Invalid session' using errcode='22023'; end if;
 select * into e from public.application_entries where id=p_entry and application_id=p_event
   and status in ('submitted','confirmed') for update;
 if not found then raise exception 'Entry unavailable' using errcode='P0002'; end if;
 if p_change='present' and not coalesce(e.status='confirmed' and
   (e.payment_status='paid' or (a.payment_method='none' and e.payment_status='not_required')),false)
   then raise exception 'Confirmed paid registration required' using errcode='P0001'; end if;
 if a.class_event ? 'sessions' then
   if p_change='clear' then
     delete from public.class_workshop_attendance where entry_id=e.id and session_at=p_session;
   else
     insert into public.class_workshop_attendance(entry_id,session_at,status) values(e.id,p_session,p_change)
       on conflict(entry_id,session_at) do update set status=excluded.status;
   end if;
 else
   update public.application_entries set class_event_attendance=case when p_change='clear' then null else p_change end where id=e.id;
 end if;
end; $$;
revoke all on function public.staff_class_event_attendance(uuid,uuid,uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.staff_class_event_attendance(uuid,uuid,uuid,timestamptz,text) to service_role;
commit;
