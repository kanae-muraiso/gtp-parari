alter table public.school_classes add column schedule_rules jsonb
  check (schedule_rules is null or jsonb_typeof(schedule_rules)='object');

create or replace function public.school_class_runs_on(p_class uuid,p_first date,p_cadence text,p_day date)
returns boolean language sql stable set search_path='' as $$
  select coalesce(
    (select p_day=any(s.days) from public.school_class_monthly_schedules s
      where s.class_id=p_class and s.month=date_trunc('month',p_day::timestamp)::date),
    (select p_day>=p_first and exists (
      select 1 from jsonb_array_elements(c.schedule_rules->'rules') r
      where case r->>'kind'
        when 'weekly' then extract(dow from p_day)=(r->>'weekday')::integer
        when 'nth' then extract(dow from p_day)=(r->>'weekday')::integer
          and ceil(extract(day from p_day)/7)=(r->>'ordinal')::integer
        when 'date' then extract(day from p_day)=(r->>'date')::integer
        else false end
    ) from public.school_classes c
    where c.id=p_class and jsonb_array_length(c.schedule_rules->'rules')>0),
    public.class_runs_on(p_first,p_cadence,p_day)
  );
$$;

create function public.save_class_schedule_rules(p_owner uuid,p_school uuid,p_class uuid,p_rules jsonb)
returns void language plpgsql set search_path='' as $$
begin
  perform 1 from public.class_schools where id=p_school and owner_user_id=p_owner and archived_at is null for share;
  if not found then raise no_data_found; end if;
  update public.school_classes set schedule_rules=p_rules where id=p_class and school_id=p_school;
  if not found then raise no_data_found; end if;
  if exists (
    select 1 from public.school_class_visit_reservations r join public.school_classes c on c.id=r.class_id
    where r.class_id=p_class and r.visit_on >= (now() at time zone 'Asia/Tokyo')::date
      and not public.school_class_runs_on(c.id,c.starts_on,c.cadence,r.visit_on)
  ) then raise exception 'class_calendar_reserved_day' using errcode='P0001'; end if;
end;
$$;
revoke all on function public.save_class_schedule_rules(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_class_schedule_rules(uuid,uuid,uuid,jsonb) to service_role;

create or replace function public.class_recurrences(p_school uuid,p_day date)
returns table(title text, starts_at timestamptz, ends_at timestamptz)
language sql stable set search_path='' as $$
  select c.name, (p_day+c.starts_at) at time zone 'Asia/Tokyo',
    ((p_day+c.starts_at) at time zone 'Asia/Tokyo')+make_interval(mins=>c.duration_minutes)
  from public.school_classes c where c.school_id=p_school
    and public.school_class_runs_on(c.id,c.starts_on,c.cadence,p_day);
$$;
