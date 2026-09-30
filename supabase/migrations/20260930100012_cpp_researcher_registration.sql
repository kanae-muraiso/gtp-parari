-- Researcher entry depends on saved required fields, independently of publication.
create function cpp_private.researcher_missing_fields(p_user uuid) returns text[]
language sql stable security definer set search_path='' as $$
 select array_remove(array[
  case when nullif(btrim(p.public_name),'') is null then '氏名' end,
  case when nullif(btrim(c.email),'') is null then 'メールアドレス' end,
  case when nullif(btrim(c.phone),'') is null then '電話番号' end,
  case when nullif(btrim(c.address),'') is null then '住所' end,
  case when p.degree_status is null then '学位の取得状況' end,
  case when p.degree_level is null then '最終学位' end,
  case when nullif(btrim(p.degree_institution),'') is null then '学位の取得場所' end,
  case when p.degree_date is null then '学位の取得・取得予定日' end
 ],null)
 from (values(p_user)) u(id)
 left join public.cpp_profiles p on p.user_id=u.id
 left join public.cpp_private_contacts c on c.user_id=u.id;
$$;

create function cpp_private.sync_researcher_membership(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare mid uuid; own_org uuid; other_org uuid; member public.membership_members%rowtype; next_status text; paused uuid;
begin
 if not exists(select 1 from auth.users where id=p_user)
 or exists(select 1 from cpp_private.mode_users where user_id=p_user) then return; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select id into mid from public.memberships where name='CPP' and membership_mode='matching' order by created_at desc limit 1;
 if mid is null then return; end if;
 select id into own_org from public.membership_organizations where membership_id=mid and organization_key='CPP-R';
 select id into other_org from public.membership_organizations where membership_id=mid and organization_key='CPP-C';
 if own_org is null or other_org is null then return; end if;
 select * into member from public.membership_members where user_id=p_user and membership_id=mid for update;
 select paused_membership_id into paused from cpp_private.alumni_participation where user_id=p_user;
 -- Never change company participation or an administrative suspension/termination.
 if member.user_id is not null and (member.organization_id is distinct from own_org
   or member.status='suspended' or (member.status='ended' and paused is distinct from mid)) then return; end if;
 if member.user_id is null and not exists(select 1 from public.cpp_profiles where user_id=p_user) then return; end if;
 next_status:=case when cardinality(cpp_private.researcher_missing_fields(p_user))=0
  and (not exists(select 1 from public.cpp_alumni where user_id=p_user)
    or exists(select 1 from cpp_private.alumni_participation where user_id=p_user and choice='researcher'))
  then 'active' else 'pending' end;
 insert into public.membership_members(membership_id,user_id,organization_id,view_organization_id,status)
 values(mid,p_user,own_org,other_org,next_status)
 on conflict(membership_id,user_id) do update set status=excluded.status,updated_at=now()
 where membership_members.status is distinct from excluded.status;
 if next_status<>'active' then
  update public.live_member_preferences set is_live=false,live_until=null where user_id=p_user and is_live;
 end if;
end $$;

create function cpp_private.researcher_registration_changed() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform cpp_private.sync_researcher_membership(case when tg_op='DELETE' then old.user_id else new.user_id end);
 return null;
end $$;
create trigger cpp_researcher_profile_saved after insert or delete or update of public_name,degree_status,degree_level,degree_institution,degree_date on public.cpp_profiles for each row execute function cpp_private.researcher_registration_changed();
create trigger cpp_researcher_contacts_saved after insert or update or delete on public.cpp_private_contacts for each row execute function cpp_private.researcher_registration_changed();
create trigger cpp_researcher_participation_changed after insert or update of choice on cpp_private.alumni_participation for each row execute function cpp_private.researcher_registration_changed();

-- Adding alumni membership preserves an existing researcher profile and its visibility.
create or replace function cpp_private.initialize_alumni_participation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from cpp_private.mode_users where user_id=new.user_id) then return new; end if;
 insert into cpp_private.alumni_participation(user_id,choice)
 values(new.user_id,case when exists(select 1 from public.cpp_profiles where user_id=new.user_id)
  or exists(select 1 from public.membership_members mm join public.memberships m on m.id=mm.membership_id
   join public.membership_organizations o on o.id=mm.organization_id
   where mm.user_id=new.user_id and m.name='CPP' and m.membership_mode='matching' and o.organization_key='CPP-R')
  then 'researcher' else 'alumni' end) on conflict do nothing;
 return new;
end $$;

create or replace function public.cpp_set_alumni_participation(p_choice text) returns void
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); prior_choice text;
begin
 if me is null or not exists(select 1 from public.cpp_alumni where user_id=me) then raise exception '同窓会への登録が必要です。'; end if;
 if p_choice is null or p_choice not in ('alumni','researcher') then raise exception '参加設定が正しくありません。'; end if;
 if exists(select 1 from cpp_private.mode_users where user_id=me) then raise exception '運営用アカウントは表示モードを利用してください。'; end if;
 perform pg_advisory_xact_lock(hashtextextended(me::text,0));
 select choice into prior_choice from cpp_private.alumni_participation where user_id=me;
 if prior_choice is distinct from p_choice and exists(select 1 from public.live_member_preferences where user_id=me and is_live and live_until>now()) then raise exception 'LIVEから退出してから参加設定を変更してください。'; end if;
 if exists(select 1 from public.membership_members mm join public.memberships m on m.id=mm.membership_id join public.membership_organizations o on o.id=mm.organization_id where mm.user_id=me and m.name='CPP' and m.membership_mode='matching' and o.organization_key='CPP-C') then raise exception '企業会員の参加設定は個別にお問い合わせください。'; end if;
 insert into cpp_private.alumni_participation(user_id,choice) values(me,p_choice)
 on conflict(user_id) do update set choice=excluded.choice,updated_at=now();
 update cpp_private.alumni_participation set paused_membership_id=null where user_id=me;
 if p_choice='alumni' then
  update public.cpp_profiles set visibility='draft',published_at=null where user_id=me and visibility<>'draft';
 end if;
end $$;

create function public.cpp_begin_researcher_registration() returns void
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();
begin
 if me is null then raise exception 'ログインしてください。' using errcode='42501'; end if;
 if exists(select 1 from cpp_private.mode_users where user_id=me) then return; end if;
 if exists(select 1 from public.membership_members mm join public.memberships m on m.id=mm.membership_id join public.membership_organizations o on o.id=mm.organization_id where mm.user_id=me and m.name='CPP' and m.membership_mode='matching' and o.organization_key='CPP-C') then raise exception '企業会員の参加設定は個別にお問い合わせください。'; end if;
 if exists(select 1 from public.cpp_alumni where user_id=me) then perform public.cpp_set_alumni_participation('researcher');
 else perform cpp_private.sync_researcher_membership(me); end if;
end $$;

create function public.cpp_researcher_registration_status()
returns table(profile_exists boolean,required_complete boolean,missing_fields text[],participating boolean,admitted boolean)
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.cpp_profiles where user_id=auth.uid()),
 cardinality(cpp_private.researcher_missing_fields(auth.uid()))=0,
 cpp_private.researcher_missing_fields(auth.uid()),
 not exists(select 1 from public.cpp_alumni where user_id=auth.uid()) or exists(select 1 from cpp_private.alumni_participation where user_id=auth.uid() and choice='researcher'),
 exists(select 1 from public.cpp_matching_context() where organization_key='CPP-R')
 where auth.uid() is not null;
$$;
revoke all on function cpp_private.researcher_missing_fields(uuid),cpp_private.sync_researcher_membership(uuid),cpp_private.researcher_registration_changed() from public,anon,authenticated;
revoke all on function public.cpp_begin_researcher_registration(),public.cpp_researcher_registration_status() from public,anon;
grant execute on function public.cpp_begin_researcher_registration(),public.cpp_researcher_registration_status() to authenticated;

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
    and (own_org.organization_key<>'CPP-R' or cardinality(cpp_private.researcher_missing_fields(auth.uid()))=0)
    and (own_org.organization_key<>'CPP-R' or not exists(select 1 from public.cpp_alumni a where a.user_id=auth.uid()) or exists(select 1 from cpp_private.alumni_participation p where p.user_id=auth.uid() and p.choice='researcher'))
  order by mm.created_at desc
  limit 1
)
select * from special union all select * from normal where not exists(select 1 from cpp_private.mode_users where user_id=auth.uid());
$function$;


create or replace function public.cpp_prepare_alumni_test(p_test_user uuid,p_scenario text) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); registered uuid; mid uuid; own_org uuid; other_org uuid; label text;
begin
 perform cpp_private.require_admin_mode();
 if p_scenario is null or p_scenario not in ('alumni','researcher_pending','researcher_approved') then raise exception 'テストする立場が正しくありません。'; end if;
 if p_test_user is null or p_test_user=me or exists(select 1 from cpp_private.mode_users where user_id=p_test_user) or public.cpp_is_staff(p_test_user) then raise exception '専用テストアカウントのみ利用できます。' using errcode='42501'; end if;
 -- Server-managed app metadata cannot be set by a general member.
 if not exists(select 1 from auth.users where id=p_test_user and raw_app_meta_data->>'cpp_test_owner'=me::text) then raise exception '他の利用者のアカウントは使えません。' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(me::text,1));
 select test_user_id into registered from cpp_private.alumni_test_accounts where operator_user_id=me;
 if registered is not null and registered<>p_test_user then raise exception '別のテスト開始処理が完了しました。もう一度お試しください。'; end if;
 if exists(select 1 from public.live_member_preferences where user_id in (me,p_test_user) and is_live and live_until>now()) then raise exception 'LIVEから退出してからテストを開始してください。'; end if;
 insert into cpp_private.alumni_test_accounts(operator_user_id,test_user_id) values(me,p_test_user) on conflict(operator_user_id) do nothing;
 label:='CPP テスト会員 '||left(me::text,8);
 insert into public.profiles(user_id,username,display_name) values(p_test_user,'cpp-test-'||left(replace(p_test_user::text,'-',''),20),label)
 on conflict(user_id) do update set display_name=excluded.display_name;
 insert into public.parari_social_profiles(user_id,display_name,affiliation,role_title,intro)
 values(p_test_user,label,'動作確認用','テスト会員','CPPの操作確認用アカウントです。')
 on conflict(user_id) do nothing;
 insert into public.cpp_alumni(user_id,participation_year,participation_location,cpp_memory)
 values(p_test_user,2015,'テスト用','CPPの操作確認用アカウントです。') on conflict(user_id) do nothing;
 insert into cpp_private.alumni_participation(user_id,choice)
 values(p_test_user,case when p_scenario='alumni' then 'alumni' else 'researcher' end)
 on conflict(user_id) do update set choice=excluded.choice,paused_membership_id=null,updated_at=now();
 update public.cpp_profiles set visibility='draft',updated_at=now() where user_id=p_test_user;
 update public.membership_members mm set status='pending',updated_at=now()
 from public.memberships m,public.membership_organizations o
 where mm.user_id=p_test_user and m.id=mm.membership_id and m.name='CPP' and m.membership_mode='matching'
 and o.id=mm.organization_id and o.organization_key='CPP-R';
 -- Reset only this dedicated fixture's entry fields; never grant membership directly.
 if p_scenario<>'alumni' then
  insert into public.cpp_profiles(user_id,public_name,degree_status,degree_level,degree_institution,degree_date)
  values(p_test_user,label,'obtained','doctorate','テスト用大学','2015-03-31')
  on conflict(user_id) do update set public_name=excluded.public_name,degree_status=excluded.degree_status,
    degree_level=excluded.degree_level,degree_institution=excluded.degree_institution,degree_date=excluded.degree_date;
  insert into public.cpp_private_contacts(user_id,email,phone,address)
  values(p_test_user,'cpp-test@example.invalid',case when p_scenario='researcher_approved' then '000-0000-0000' else null end,'テスト用住所')
  on conflict(user_id) do update set email=excluded.email,phone=excluded.phone,address=excluded.address;
 end if;
 perform cpp_private.sync_researcher_membership(p_test_user);
end $$;

-- Bring existing saved profiles under the same entry rule, preserving opt-outs and suspensions.
do $$ declare member_id uuid; begin
 for member_id in select user_id from public.cpp_profiles
 union select mm.user_id from public.membership_members mm
 join public.memberships m on m.id=mm.membership_id and m.name='CPP' and m.membership_mode='matching'
 join public.membership_organizations o on o.id=mm.organization_id and o.organization_key='CPP-R'
 loop perform cpp_private.sync_researcher_membership(member_id); end loop;
end $$;
notify pgrst,'reload schema';
