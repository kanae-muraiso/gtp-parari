-- Draft: CLASS B ordinary capacity and monthly publication quotas.
-- Apply after class-b-class-blocks-draft.sql and validate in an isolated DB.
begin;
create function public.class_b_enforce_capacity(p_school uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.class_feature_plans p
   where p.school_id=p_school and p.plan='b' and (p.active_until is null or p.active_until>now()));
$$;

-- Count recurring fixed seats, not flexible eligibility assignments. Flexible
-- reservations consume a seat on the selected lesson date instead.
create function public.class_b_assert_fixed_seats(p_school uuid,p_class uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if not public.class_b_enforce_capacity(p_school) then return; end if;
 perform 1 from public.class_schools where id=p_school for no key update;
 if (select count(*) from public.school_class_assignments a join public.school_enrollments e
      on e.id=a.enrollment_id and e.school_id=a.school_id
      where a.school_id=p_school and a.class_id=p_class and e.status='active'
      and (a.self_selected or e.class_participation<>'flexible'))>30 then
   raise exception 'CLASS B fixed seat allowance exceeded' using errcode='P0013';
 end if;
 -- A new fixed seat must not make an existing future flexible booking overfull.
 if exists(select 1 from public.school_class_visit_reservations r
    where r.school_id=p_school and r.class_id=p_class and r.visit_on>=(now() at time zone 'Asia/Tokyo')::date
    group by r.visit_on having count(*)+public.class_fixed_seat_count_on(p_school,p_class,r.visit_on)>30) then
   raise exception 'CLASS B lesson capacity exceeded' using errcode='P0013';
 end if;
end; $$;

create function public.class_b_guard_assignment() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' then
   if new.school_id=old.school_id and new.class_id=old.class_id and new.enrollment_id=old.enrollment_id
     and (not new.self_selected or old.self_selected) then return new; end if;
 end if;
 perform public.class_b_assert_fixed_seats(new.school_id,new.class_id);
 return new;
end; $$;
create trigger class_b_assignment_capacity after insert or update of school_id,class_id,enrollment_id,self_selected
 on public.school_class_assignments for each row execute function public.class_b_guard_assignment();

create function public.class_b_guard_enrollment() returns trigger language plpgsql set search_path='' as $$
declare v_class uuid;
begin
 if new.status<>'active' then return new; end if;
 if tg_op='UPDATE' then
   if old.status='active' and old.school_id=new.school_id and old.class_participation=new.class_participation then return new; end if;
 end if;
 for v_class in select distinct class_id from public.school_class_assignments where school_id=new.school_id and enrollment_id=new.id loop
   perform public.class_b_assert_fixed_seats(new.school_id,v_class);
 end loop;
 return new;
end; $$;
create trigger class_b_enrollment_capacity after insert or update of status,school_id,class_participation
 on public.school_enrollments for each row execute function public.class_b_guard_enrollment();

create function public.class_b_guard_visit() returns trigger language plpgsql set search_path='' as $$
begin
 if not public.class_b_enforce_capacity(new.school_id) then return new; end if;
 perform 1 from public.class_schools where id=new.school_id for no key update;
 if public.class_fixed_seat_count_on(new.school_id,new.class_id,new.visit_on)+
   (select count(*) from public.school_class_visit_reservations
     where school_id=new.school_id and class_id=new.class_id and visit_on=new.visit_on)>30 then
   raise exception 'CLASS B lesson capacity exceeded' using errcode='P0013';
 end if;
 return new;
end; $$;
create trigger class_b_visit_capacity after insert or update of school_id,class_id,visit_on,enrollment_id
 on public.school_class_visit_reservations for each row execute function public.class_b_guard_visit();

-- Event quotas apply per distinct calendar month, Asia/Tokyo. Closed/archived
-- events continue to occupy their slots. An event with multiple sessions is
-- counted once in each month where at least one session occurs.
create function public.class_b_event_months(p_event jsonb) returns setof date
language sql stable set search_path='' as $$
 select distinct date_trunc('month',(item->>'startsAt')::timestamptz at time zone 'Asia/Tokyo')::date
 from jsonb_array_elements(coalesce(p_event->'sessions',jsonb_build_array(p_event))) item;
$$;
create function public.class_b_guard_event_quota() returns trigger language plpgsql set search_path='' as $$
declare m date;
begin
 if new.class_event_school_id is null or new.status not in ('open','closed') then return new; end if;
 if tg_op='UPDATE' then
   if old.status in ('open','closed') and new.class_event_school_id is not distinct from old.class_event_school_id
      and new.class_event is not distinct from old.class_event and new.definition is not distinct from old.definition
      and new.payment_method is not distinct from old.payment_method and new.payment_amount is not distinct from old.payment_amount then return new; end if;
 end if;
 perform 1 from public.class_schools where id=new.class_event_school_id for no key update;
 -- Square-only exemption: the application route verifies the live connection
 -- and seller disclosure before publishing. A payment link is not exempt.
 if new.payment_method='parari' and coalesce(new.payment_amount,0)>0
    and new.class_event->>'registration'='true' then return new; end if;
 if coalesce(new.definition->>'capacity','') !~ '^[0-9]+$' then
   raise exception 'CLASS B event capacity must be 1-50' using errcode='P0014';
 end if;
 if (new.definition->>'capacity')::numeric not between 1 and 50 then
   raise exception 'CLASS B event capacity must be 1-50' using errcode='P0014';
 end if;
 for m in select public.class_b_event_months(new.class_event) loop
   if (select count(*) from public.applications a where a.class_event_school_id=new.class_event_school_id
      and a.id<>new.id and a.status in ('open','closed')
      and not (a.payment_method is not distinct from 'parari' and coalesce(a.payment_amount,0)>0
               and coalesce(a.class_event->>'registration','false')='true')
      and m in(select public.class_b_event_months(a.class_event)))>=3 then
     raise exception 'CLASS B monthly event allowance exceeded' using errcode='P0015';
   end if;
 end loop;
 return new;
end; $$;
create trigger class_b_event_quota before insert or update of status,class_event_school_id,class_event,definition,payment_method,payment_amount
 on public.applications for each row execute function public.class_b_guard_event_quota();
revoke all on function public.class_b_enforce_capacity(uuid),public.class_b_assert_fixed_seats(uuid,uuid),
 public.class_b_guard_assignment(),public.class_b_guard_enrollment(),public.class_b_guard_visit(),
 public.class_b_event_months(jsonb),public.class_b_guard_event_quota() from public,anon,authenticated;
grant execute on function public.class_b_enforce_capacity(uuid),public.class_b_assert_fixed_seats(uuid,uuid),
 public.class_b_event_months(jsonb) to service_role;
commit;
