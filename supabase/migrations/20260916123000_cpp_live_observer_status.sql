alter table public.live_member_preferences
  drop constraint if exists live_member_preferences_availability_check;

alter table public.live_member_preferences
  add constraint live_member_preferences_availability_check
  check (availability in ('available','observe','away'));

create or replace function public.cpp_live_set_availability(p_availability text)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_membership_id uuid;
begin
  if p_availability not in ('available','observe','away') then
    raise exception 'Invalid availability';
  end if;

  select mm.membership_id into v_membership_id
  from public.membership_members mm
  join public.memberships m on m.id=mm.membership_id
  where mm.user_id=auth.uid()
    and mm.status='active'
    and m.name='CPP'
    and m.membership_mode='matching'
  order by mm.created_at desc
  limit 1;

  if v_membership_id is null then raise exception 'CPP membership required'; end if;

  insert into public.live_member_preferences(membership_id,user_id,availability,updated_at)
  values(v_membership_id,auth.uid(),p_availability,now())
  on conflict(membership_id,user_id)
  do update set availability=excluded.availability,updated_at=now();
end;
$$;

create or replace function public.cpp_live_enter_as(p_minutes integer default 60, p_availability text default 'available')
returns table(live_until timestamptz)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_membership_id uuid;
  v_minutes integer:=greatest(10,least(coalesce(p_minutes,60),240));
  v_until timestamptz;
  v_availability text:=coalesce(p_availability,'available');
begin
  if v_availability not in ('available','observe') then
    raise exception 'Invalid entry availability';
  end if;

  v_membership_id:=public.cpp_live_my_membership_id();
  if v_membership_id is null then raise exception 'CPP membership required'; end if;

  v_until:=now()+make_interval(mins=>v_minutes);
  insert into public.live_member_preferences(
    membership_id,user_id,availability,open_talk,live_entered_at,live_until,last_seen_at,is_live,updated_at
  ) values(
    v_membership_id,auth.uid(),v_availability,false,now(),v_until,now(),true,now()
  )
  on conflict(membership_id,user_id)
  do update set availability=v_availability,live_entered_at=now(),live_until=v_until,last_seen_at=now(),is_live=true,open_talk=false,updated_at=now();

  return query select v_until;
end;
$$;

create or replace function public.cpp_live_roster(p_target_user_ids uuid[])
returns table(
  user_id uuid,
  display_name text,
  photo_url text,
  affiliation text,
  role_title text,
  organization_key text,
  live_status text,
  open_talk boolean,
  waiting_count integer
)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  with viewer as (
    select mm.membership_id,mm.organization_id,mm.view_organization_id
    from public.membership_members mm
    join public.memberships m on m.id=mm.membership_id
    where mm.user_id=auth.uid()
      and mm.status='active'
      and m.name='CPP'
      and m.membership_mode='matching'
    order by mm.created_at desc
    limit 1
  )
  select t.user_id,
    coalesce(nullif(sp.display_name,''),nullif(p.display_name,''),nullif(p.username,''),'PARARI USER'),
    coalesce(sp.photo_url,p.avatar_url),
    sp.affiliation,
    sp.role_title,
    org.organization_key,
    case
      when public.cpp_live_is_user_busy(v.membership_id,t.user_id) then 'chatting'
      when coalesce(pref.availability,'available')='away' then 'away'
      when coalesce(pref.availability,'available')='observe' then 'observe'
      else 'available'
    end,
    coalesce(pref.open_talk,false),
    (
      select count(*)::int
      from public.live_open_talk_queue q
      where q.membership_id=v.membership_id
        and q.host_user_id=t.user_id
        and q.status='waiting'
    )
  from viewer v
  join public.membership_members t
    on t.membership_id=v.membership_id
   and t.status='active'
   and (t.user_id=auth.uid() or t.user_id=any(coalesce(p_target_user_ids,'{}'::uuid[])))
  join public.membership_organizations org on org.id=t.organization_id
  left join public.live_member_preferences pref on pref.membership_id=v.membership_id and pref.user_id=t.user_id
  left join public.parari_social_profiles sp on sp.user_id=t.user_id
  left join public.profiles p on p.user_id=t.user_id;
$$;

revoke all on function public.cpp_live_enter_as(integer,text) from public;
grant execute on function public.cpp_live_enter_as(integer,text) to authenticated;
revoke all on function public.cpp_live_set_availability(text) from public;
grant execute on function public.cpp_live_set_availability(text) to authenticated;
