-- Operator presence is deliberately separate from normal LIVE matchmaking.
create table if not exists cpp_private.live_operator_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now()
);
revoke all on cpp_private.live_operator_presence from public,anon,authenticated;

create or replace function public.cpp_live_operator_presence(p_active boolean default true)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from cpp_private.mode_users u
    where u.user_id=auth.uid() and u.mode='admin'
  ) then
    raise exception '管理者モードが必要です' using errcode='42501';
  end if;
  if p_active then
    insert into cpp_private.live_operator_presence(user_id,expires_at,last_seen_at)
    values(auth.uid(),now()+interval '60 minutes',now())
    on conflict(user_id) do update
      set expires_at=now()+interval '60 minutes',last_seen_at=now();
  else
    delete from cpp_private.live_operator_presence where user_id=auth.uid();
  end if;
end $$;
revoke all on function public.cpp_live_operator_presence(boolean) from public,anon;
grant execute on function public.cpp_live_operator_presence(boolean) to authenticated;

create or replace function public.cpp_live_operator_heartbeat()
returns void language plpgsql security definer set search_path = ''
as $$
begin
 if auth.uid() is null or not exists (
  select 1 from cpp_private.mode_users u
  where u.user_id=auth.uid() and u.mode='admin'
 ) then raise exception '管理者モードが必要です' using errcode='42501'; end if;
 update cpp_private.live_operator_presence
 set last_seen_at=now()
 where user_id=auth.uid() and expires_at>now();
end $$;
revoke all on function public.cpp_live_operator_heartbeat() from public,anon;
grant execute on function public.cpp_live_operator_heartbeat() to authenticated;

create or replace function public.cpp_live_operator_roster()
returns table(user_id uuid,display_name text,photo_url text,is_me boolean)
language sql stable security definer set search_path = ''
as $$
select pr.user_id,
  coalesce(nullif(sp.display_name,''),nullif(p.display_name,''),'CPP運営'),
  coalesce(sp.photo_url,p.avatar_url),
  pr.user_id=auth.uid()
from cpp_private.live_operator_presence pr
join cpp_private.mode_users u on u.user_id=pr.user_id and u.mode='admin'
left join public.parari_social_profiles sp on sp.user_id=pr.user_id
left join public.profiles p on p.user_id=pr.user_id
where auth.uid() is not null
 and (exists(select 1 from public.cpp_alumni a where a.user_id=auth.uid())
  or exists(select 1 from public.cpp_matching_context())
  or exists(select 1 from cpp_private.mode_users x where x.user_id=auth.uid()))
 and pr.expires_at>now() and pr.last_seen_at>now()-interval '2 minutes';
$$;
revoke all on function public.cpp_live_operator_roster() from public,anon;
grant execute on function public.cpp_live_operator_roster() to authenticated;
