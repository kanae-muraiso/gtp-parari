-- New alumni start with no matching access; retain prior approval for resumption.
create function cpp_private.initialize_alumni_participation() returns trigger language plpgsql security definer set search_path='' as $$
declare mid uuid;
begin
 if exists(select 1 from cpp_private.mode_users where user_id=new.user_id) then return new; end if;
 select mm.membership_id into mid from public.membership_members mm
 join public.memberships m on m.id=mm.membership_id and m.name='CPP' and m.membership_mode='matching'
 join public.membership_organizations o on o.id=mm.organization_id and o.organization_key='CPP-R'
 where mm.user_id=new.user_id and mm.status='active' order by mm.created_at desc limit 1;
 insert into cpp_private.alumni_participation(user_id,paused_membership_id) values(new.user_id,mid) on conflict do nothing;
 if mid is not null then update public.membership_members set status='ended',updated_at=now() where user_id=new.user_id and membership_id=mid; end if;
 update public.cpp_profiles set visibility='draft',updated_at=now() where user_id=new.user_id;
 return new;
end $$;
revoke all on function cpp_private.initialize_alumni_participation() from public,anon,authenticated;
create trigger cpp_initialize_alumni_participation after insert on public.cpp_alumni for each row execute function cpp_private.initialize_alumni_participation();

create table cpp_private.alumni_test_accounts (
 operator_user_id uuid primary key references auth.users(id) on delete cascade,
 test_user_id uuid not null unique references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 check(operator_user_id<>test_user_id)
);
alter table cpp_private.alumni_test_accounts enable row level security;
revoke all on cpp_private.alumni_test_accounts from public,anon,authenticated;

create function public.cpp_alumni_test_account() returns uuid language plpgsql stable security definer set search_path='' as $$
begin
 perform cpp_private.require_admin_mode();
 return (select test_user_id from cpp_private.alumni_test_accounts where operator_user_id=auth.uid());
end $$;

create function public.cpp_prepare_alumni_test(p_test_user uuid,p_scenario text) returns void language plpgsql security definer set search_path='' as $$
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
 select id into mid from public.memberships where name='CPP' and membership_mode='matching' order by created_at desc limit 1;
 if mid is null then raise exception 'CPPの入室設定が見つかりません。'; end if;
 select id into own_org from public.membership_organizations where membership_id=mid and organization_key='CPP-R';
 select id into other_org from public.membership_organizations where membership_id=mid and organization_key='CPP-C';
 if own_org is null or other_org is null then raise exception 'CPPの立場設定が見つかりません。'; end if;
 insert into public.membership_members(membership_id,user_id,organization_id,view_organization_id,status)
 values(mid,p_test_user,own_org,other_org,case when p_scenario='researcher_approved' then 'active' when p_scenario='researcher_pending' then 'pending' else 'ended' end)
 on conflict(membership_id,user_id) do update set organization_id=excluded.organization_id,view_organization_id=excluded.view_organization_id,status=excluded.status,updated_at=now();
end $$;
revoke all on function public.cpp_alumni_test_account(),public.cpp_prepare_alumni_test(uuid,text) from public,anon;
grant execute on function public.cpp_alumni_test_account(),public.cpp_prepare_alumni_test(uuid,text) to authenticated;
notify pgrst,'reload schema';
