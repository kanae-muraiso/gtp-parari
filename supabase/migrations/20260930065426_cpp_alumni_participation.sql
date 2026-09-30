create table cpp_private.alumni_participation (
 user_id uuid primary key references auth.users(id) on delete cascade,
 choice text not null default 'alumni' check(choice in ('alumni','researcher')),
 paused_membership_id uuid references public.memberships(id),
 updated_at timestamptz not null default now()
);
alter table cpp_private.alumni_participation enable row level security;
revoke all on cpp_private.alumni_participation from public,anon,authenticated;
create function public.cpp_alumni_participation_status() returns table(is_alumni boolean,choice text,admitted boolean,is_operator boolean)
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.cpp_alumni where user_id=auth.uid()),
 coalesce((select p.choice from cpp_private.alumni_participation p where p.user_id=auth.uid()),'alumni'),
 exists(select 1 from public.cpp_matching_context() c where c.organization_key='CPP-R'),
 exists(select 1 from cpp_private.mode_users where user_id=auth.uid())
 where auth.uid() is not null;
$$;
create function public.cpp_set_alumni_participation(p_choice text) returns void
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); mid uuid; prior uuid;
begin
 if me is null or not exists(select 1 from public.cpp_alumni where user_id=me) then raise exception '同窓会への登録が必要です。'; end if;
 if p_choice not in ('alumni','researcher') or p_choice is null then raise exception '参加設定が正しくありません。'; end if;
 if exists(select 1 from cpp_private.mode_users where user_id=me) then raise exception '運営用アカウントは表示モードを利用してください。'; end if;
 perform pg_advisory_xact_lock(hashtextextended(me::text,0));
 if exists(select 1 from public.live_member_preferences where user_id=me and is_live and live_until>now()) then raise exception 'LIVEから退出してから参加設定を変更してください。'; end if;
 if exists(select 1 from public.membership_members mm join public.memberships m on m.id=mm.membership_id join public.membership_organizations o on o.id=mm.organization_id where mm.user_id=me and mm.status='active' and m.name='CPP' and m.membership_mode='matching' and o.organization_key='CPP-C') then raise exception '企業会員の参加設定は個別にお問い合わせください。'; end if;
 insert into cpp_private.alumni_participation(user_id) values(me) on conflict do nothing;
 select paused_membership_id into prior from cpp_private.alumni_participation where user_id=me for update;
 if p_choice='alumni' then
  select mm.membership_id into mid from public.membership_members mm join public.memberships m on m.id=mm.membership_id join public.membership_organizations o on o.id=mm.organization_id where mm.user_id=me and mm.status='active' and m.name='CPP' and m.membership_mode='matching' and o.organization_key='CPP-R' order by mm.created_at desc limit 1;
  if mid is not null then update public.membership_members set status='ended',updated_at=now() where user_id=me and membership_id=mid; end if;
  update public.cpp_profiles set visibility='draft',updated_at=now() where user_id=me;
  update cpp_private.alumni_participation set choice=p_choice,paused_membership_id=coalesce(mid,prior),updated_at=now() where user_id=me;
 else
  -- Only an approval previously paused by this RPC can be resumed.
  update public.membership_members mm set status='active',updated_at=now() from public.membership_organizations o where mm.user_id=me and mm.membership_id=prior and mm.status='ended' and o.id=mm.organization_id and o.organization_key='CPP-R';
  update cpp_private.alumni_participation set choice=p_choice,paused_membership_id=null,updated_at=now() where user_id=me;
 end if;
end $$;
revoke all on function public.cpp_alumni_participation_status(),public.cpp_set_alumni_participation(text) from public,anon;
grant execute on function public.cpp_alumni_participation_status(),public.cpp_set_alumni_participation(text) to authenticated;
CREATE OR REPLACE FUNCTION public.cpp_matching_context()
 RETURNS TABLE(membership_id uuid, organization_id uuid, organization_key text, view_organization_id uuid, view_organization_key text, joined_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    and (own_org.organization_key<>'CPP-R' or not exists(select 1 from public.cpp_alumni a where a.user_id=auth.uid()) or exists(select 1 from cpp_private.alumni_participation p where p.user_id=auth.uid() and p.choice='researcher'))
  order by mm.created_at desc
  limit 1
)
select * from special union all select * from normal where not exists(select 1 from cpp_private.mode_users where user_id=auth.uid());
$function$;

create or replace function public.cpp_live_my_membership_id() returns uuid language sql stable security definer set search_path='' as $$ select membership_id from public.cpp_matching_context() limit 1 $$;
create function cpp_private.enforce_alumni_profile_visibility() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.visibility='published' and exists(select 1 from public.cpp_alumni where user_id=new.user_id) and not exists(select 1 from cpp_private.mode_users where user_id=new.user_id) and not exists(select 1 from cpp_private.alumni_participation where user_id=new.user_id and choice='researcher') then
 raise exception '研究者として参加する設定を選択してから公開してください。';
 end if; return new;
end $$;
revoke all on function cpp_private.enforce_alumni_profile_visibility() from public,anon,authenticated;
create trigger cpp_alumni_profile_visibility before insert or update of visibility on public.cpp_profiles for each row execute function cpp_private.enforce_alumni_profile_visibility();
-- Default to alumni only; retain existing approvals for explicit resumption.
insert into cpp_private.alumni_participation(user_id,paused_membership_id)
select a.user_id,mm.membership_id from public.cpp_alumni a join public.membership_members mm on mm.user_id=a.user_id and mm.status='active'
join public.memberships m on m.id=mm.membership_id and m.name='CPP' and m.membership_mode='matching'
join public.membership_organizations o on o.id=mm.organization_id and o.organization_key='CPP-R'
where not exists(select 1 from cpp_private.mode_users u where u.user_id=a.user_id);
update public.membership_members mm set status='ended',updated_at=now() from cpp_private.alumni_participation p where mm.user_id=p.user_id and mm.membership_id=p.paused_membership_id;
update public.cpp_profiles p set visibility='draft',updated_at=now() where exists(select 1 from public.cpp_alumni a where a.user_id=p.user_id) and not exists(select 1 from cpp_private.mode_users u where u.user_id=p.user_id);
notify pgrst,'reload schema';
