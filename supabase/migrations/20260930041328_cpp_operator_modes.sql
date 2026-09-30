create schema if not exists cpp_private;
revoke all on schema cpp_private from public,anon,authenticated;
create table cpp_private.mode_users (
 user_id uuid primary key references auth.users(id),
 protected boolean not null default false,
 mode text not null default 'researcher' check(mode in ('researcher','company','admin'))
);
alter table cpp_private.mode_users enable row level security;
insert into cpp_private.mode_users(user_id,protected)
select user_id, username='kanae-muraiso' from public.profiles where username in ('kanae-muraiso','yass-mint');
create function cpp_private.protect_mode_owner() returns trigger language plpgsql set search_path='' as $$
begin
 if old.protected and (TG_OP='DELETE' or new.user_id<>old.user_id or not new.protected) then
 raise exception 'この管理者は削除・保護解除できません'; end if;
 if TG_OP='DELETE' then return old; end if; return new;
end $$;
create trigger protect_mode_owner before delete or update on cpp_private.mode_users for each row execute function cpp_private.protect_mode_owner();
create function public.cpp_mode_status() returns table(mode text,can_switch boolean) language sql stable security definer set search_path='' as $$
 select u.mode,true from cpp_private.mode_users u where u.user_id=auth.uid();
$$;
create function public.cpp_set_mode(p_mode text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from cpp_private.mode_users where user_id=auth.uid()) then raise exception 'モード切替権限がありません' using errcode='42501'; end if;
 if p_mode not in ('researcher','company','admin') or p_mode is null then raise exception 'Invalid mode'; end if;
 if exists(select 1 from public.live_member_preferences where user_id=auth.uid() and is_live and live_until>now()) then raise exception 'LIVEから退出してからモードを切り替えてください'; end if;
 update cpp_private.mode_users set mode=p_mode where user_id=auth.uid();
end $$;
create function cpp_private.require_admin_mode() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from cpp_private.mode_users where user_id=auth.uid() and mode='admin') then raise exception '管理者モード限定です' using errcode='42501'; end if;
end $$;
create function public.cpp_mode_users() returns table(user_id uuid,username text,protected boolean) language plpgsql security definer set search_path='' as $$
begin
 perform cpp_private.require_admin_mode();
 return query select u.user_id,p.username::text,u.protected from cpp_private.mode_users u join public.profiles p on p.user_id=u.user_id order by u.protected desc,p.username;
end $$;
create function public.cpp_add_mode_user(p_username text) returns void language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 perform cpp_private.require_admin_mode();
 select user_id into target from public.profiles where username=trim(p_username);
 if target is null then raise exception 'ユーザー名が見つかりません'; end if;
 insert into cpp_private.mode_users(user_id) values(target) on conflict(user_id) do nothing;
end $$;
create function public.cpp_remove_mode_user(p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform cpp_private.require_admin_mode();
 if p_user_id=auth.uid() then raise exception '自分自身は削除できません'; end if;
 delete from cpp_private.mode_users where user_id=p_user_id;
end $$;
revoke all on function public.cpp_mode_status(),public.cpp_set_mode(text),public.cpp_mode_users(),public.cpp_add_mode_user(text),public.cpp_remove_mode_user(uuid) from public,anon;
grant execute on function public.cpp_mode_status(),public.cpp_set_mode(text),public.cpp_mode_users(),public.cpp_add_mode_user(text),public.cpp_remove_mode_user(uuid) to authenticated;
revoke all on all functions in schema cpp_private from public,anon,authenticated;

create or replace function public.cpp_matching_context()
returns table(membership_id uuid,organization_id uuid,organization_key text,view_organization_id uuid,view_organization_key text,joined_at timestamptz)
language sql stable security definer set search_path='' as $$
with special as (
 select m.id membership_id,own_org.id organization_id,own_org.organization_key,
 other_org.id view_organization_id,other_org.organization_key view_organization_key,now() joined_at
 from cpp_private.mode_users u
 cross join lateral (select id from public.memberships where name='CPP' and membership_mode='matching' order by created_at desc limit 1) m
 join public.membership_organizations own_org on own_org.membership_id=m.id and own_org.organization_key=case u.mode when 'researcher' then 'CPP-R' else 'CPP-C' end
 join public.membership_organizations other_org on other_org.membership_id=m.id and other_org.organization_key=case u.mode when 'researcher' then 'CPP-C' else 'CPP-R' end
 where u.user_id=auth.uid() and u.mode<>'admin'
), normal as (
  select
    mm.membership_id,
    mm.organization_id,
    own_org.organization_key,
    mm.view_organization_id,
    view_org.organization_key,
    mm.created_at
  from public.membership_members mm
  join public.memberships m on m.id = mm.membership_id and m.name = 'CPP' and m.membership_mode = 'matching'
  left join public.membership_organizations own_org on own_org.id = mm.organization_id
  left join public.membership_organizations view_org on view_org.id = mm.view_organization_id
  where mm.user_id = auth.uid()
    and mm.status = 'active'
  order by mm.created_at desc
  limit 1
)
select * from special union all select * from normal where not exists(select 1 from cpp_private.mode_users where user_id=auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.cpp_matching_member_social_profile(p_target_user_id uuid)
 RETURNS TABLE(user_id uuid, display_name text, photo_url text, affiliation text, role_title text, topics text[], intro text, organization_key text, joined_at timestamp with time zone, can_view_deep boolean, deep_kind text, deep_target_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$;
  with viewer as (
    select membership_id,organization_id,view_organization_id from public.cpp_matching_context()
  ), target as (
    select mm.*
    from viewer v
    join public.membership_members mm on mm.membership_id = v.membership_id
    where mm.user_id = p_target_user_id
      and mm.status = 'active'
      and mm.organization_id is not null
      and (mm.organization_id = v.organization_id or mm.organization_id = v.view_organization_id)
    limit 1
  ), target_company as (
    select cm.company_id
    from public.cpp_company_members cm
    where cm.user_id = p_target_user_id
      and cm.role in ('owner','editor')
    order by cm.created_at
    limit 1
  )
  select
    t.user_id,
    coalesce(nullif(sp.display_name, ''), nullif(p.display_name, ''), nullif(p.username, ''), 'PARARI USER') as display_name,
    coalesce(sp.photo_url, p.avatar_url) as photo_url,
    sp.affiliation,
    sp.role_title,
    coalesce(sp.topics, '{}'::text[]) as topics,
    sp.intro,
    org.organization_key,
    t.created_at,
    (t.organization_id = v.view_organization_id) as can_view_deep,
    case
      when t.organization_id <> v.view_organization_id then null
      when org.organization_key = 'CPP-R' then 'researcher'
      when org.organization_key = 'CPP-C' then 'company'
      else null
    end as deep_kind,
    case
      when t.organization_id <> v.view_organization_id then null
      when org.organization_key = 'CPP-R' then t.user_id
      when org.organization_key = 'CPP-C' then tc.company_id
      else null
    end as deep_target_id
  from target t
  join viewer v on true
  join public.membership_organizations org on org.id = t.organization_id
  left join public.parari_social_profiles sp on sp.user_id = t.user_id
  left join public.profiles p on p.user_id = t.user_id
  left join target_company tc on true;
$function$;

CREATE OR REPLACE FUNCTION public.cpp_matching_visible_members()
 RETURNS TABLE(user_id uuid, display_name text, photo_url text, affiliation text, role_title text, topics text[], intro text, joined_at timestamp with time zone, organization_key text, social_profile_complete boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$;
  with viewer as (
    select mm.membership_id, mm.view_organization_id
    from public.membership_members mm
    join public.memberships m on m.id = mm.membership_id and m.name = 'CPP' and m.membership_mode = 'matching'
    where mm.user_id = auth.uid()
      and mm.status = 'active'
    order by mm.created_at desc
    limit 1
  )
  select
    target.user_id,
    coalesce(nullif(sp.display_name, ''), nullif(p.display_name, ''), nullif(p.username, ''), 'PARARI USER') as display_name,
    coalesce(sp.photo_url, p.avatar_url) as photo_url,
    sp.affiliation,
    sp.role_title,
    coalesce(sp.topics, '{}'::text[]) as topics,
    sp.intro,
    target.created_at as joined_at,
    org.organization_key,
    (sp.user_id is not null and nullif(sp.display_name, '') is not null) as social_profile_complete
  from viewer v
  join public.membership_members target
    on target.membership_id = v.membership_id
   and target.organization_id = v.view_organization_id
   and target.status = 'active'
  join public.membership_organizations org on org.id = target.organization_id
  left join public.parari_social_profiles sp on sp.user_id = target.user_id
  left join public.profiles p on p.user_id = target.user_id
  where target.user_id <> auth.uid();
$function$;
