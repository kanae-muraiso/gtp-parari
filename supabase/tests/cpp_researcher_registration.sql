-- Real permission checks, with synthetic accounts and complete rollback.
begin;
select set_config('cpp.test_researcher',gen_random_uuid()::text,true);
select set_config('cpp.test_alumnus',gen_random_uuid()::text,true);
select set_config('cpp.test_settings',gen_random_uuid()::text,true);
insert into auth.users(id,email) select current_setting(k)::uuid,'registration-'||current_setting(k)||'@example.invalid'
from unnest(array['cpp.test_researcher','cpp.test_alumnus','cpp.test_settings']) k;

-- Route 1: researcher -> alumni, keeping profile, publication and active membership.
select set_config('request.jwt.claim.sub',current_setting('cpp.test_researcher'),true);
set local role authenticated;
select public.cpp_begin_researcher_registration();
insert into public.cpp_profiles(user_id,public_name,degree_status,degree_level,degree_institution,degree_date)
values(auth.uid(),'登録確認','obtained','doctorate','確認大学','2015-03-31');
do $$ begin
 if exists(select 1 from public.cpp_matching_context()) then raise exception 'Incomplete researcher admitted'; end if;
 if exists(select 1 from public.cpp_alumni where user_id=auth.uid()) then raise exception 'Researcher acquired alumni membership'; end if;
 begin
  perform public.cpp_set_alumni_participation('researcher');
  raise exception 'Non-alumnus changed alumni settings';
 exception when raise_exception then
  if sqlerrm='Non-alumnus changed alumni settings' then raise; end if;
 end;
end $$;
insert into public.cpp_private_contacts(user_id,email,phone,address) values(auth.uid(),'check@example.invalid','000-0000-0000','確認住所');
do $$ begin
 if not exists(select 1 from public.cpp_researcher_registration_status() where required_complete and admitted) then raise exception 'Complete draft researcher denied'; end if;
 if not exists(select 1 from public.cpp_profiles where user_id=auth.uid() and visibility='draft') then raise exception 'Profile automatically published'; end if;
end $$;
update public.cpp_profiles set visibility='published',published_at=now() where user_id=auth.uid();
insert into public.cpp_alumni(user_id,participation_year,participation_location,cpp_memory) values(auth.uid(),2015,'確認会場','登録確認');
do $$ begin
 if not exists(select 1 from public.cpp_alumni_participation_status() where is_alumni and choice='researcher' and admitted) then raise exception 'Adding alumni removed research participation'; end if;
 if not exists(select 1 from public.cpp_profiles where user_id=auth.uid() and public_name='登録確認' and visibility='published' and published_at is not null) then raise exception 'Alumni registration changed profile/publication'; end if;
 if cpp_security.can_read_researcher(current_setting('cpp.test_alumnus')::uuid) then raise exception 'Researcher can view peer details'; end if;
end $$;

-- Route 2: alumni -> entry registration, including re-entry with an existing draft.
select set_config('request.jwt.claim.sub',current_setting('cpp.test_alumnus'),true);
insert into public.cpp_alumni(user_id,participation_year,participation_location,cpp_memory) values(auth.uid(),2015,'確認会場','残す思い出');
select public.cpp_begin_researcher_registration();
insert into public.cpp_profiles(user_id,public_name,degree_status,degree_level,degree_institution,degree_date)
values(auth.uid(),'同窓会から登録','expected','doctorate','確認大学','2027-03-31');
insert into public.cpp_private_contacts(user_id,email,phone,address) values(auth.uid(),'check@example.invalid','000-0000-0000','確認住所');
do $$ begin
 if not exists(select 1 from public.cpp_matching_context() where organization_key='CPP-R' and view_organization_key='CPP-C') then raise exception 'Alumni entry registration denied'; end if;
 if not exists(select 1 from public.cpp_alumni where user_id=auth.uid() and cpp_memory='残す思い出') then raise exception 'Alumni profile lost'; end if;
end $$;
select public.cpp_set_alumni_participation('alumni');
do $$ begin if exists(select 1 from public.cpp_matching_context()) then raise exception 'Opt-out ineffective'; end if; end $$;
update public.cpp_profiles set public_name='保持する下書き' where user_id=auth.uid();
do $$ begin if exists(select 1 from public.cpp_matching_context()) then raise exception 'Editing draft opted user back in'; end if; end $$;
select public.cpp_begin_researcher_registration();
select public.cpp_begin_researcher_registration();
do $$ begin
 if not exists(select 1 from public.cpp_matching_context()) then raise exception 'Entry re-registration denied'; end if;
 if not exists(select 1 from public.cpp_profiles where user_id=auth.uid() and public_name='保持する下書き' and visibility='draft') then raise exception 'Existing draft overwritten'; end if;
end $$;

-- Route 3: settings -> required fields, admission only after the final field is saved.
select set_config('request.jwt.claim.sub',current_setting('cpp.test_settings'),true);
insert into public.cpp_alumni(user_id,participation_year,participation_location,cpp_memory) values(auth.uid(),2015,'確認会場','設定経路の確認');
select public.cpp_set_alumni_participation('researcher');
insert into public.cpp_profiles(user_id,public_name,degree_status,degree_level,degree_institution,degree_date)
values(auth.uid(),'設定から登録','obtained','masters','確認大学','2015-03-31');
insert into public.cpp_private_contacts(user_id,email,phone,address) values(auth.uid(),'check@example.invalid','   ','確認住所');
do $$ begin
 if not exists(select 1 from public.cpp_researcher_registration_status() where missing_fields=array['電話番号'] and not admitted) then raise exception 'Wrong missing-field check'; end if;
end $$;
update public.cpp_private_contacts set phone='000-0000-0000' where user_id=auth.uid();
do $$ begin if not exists(select 1 from public.cpp_matching_context()) then raise exception 'Saved final field did not admit'; end if; end $$;
select public.cpp_set_alumni_participation('alumni');
select public.cpp_set_alumni_participation('researcher');
do $$ begin if not exists(select 1 from public.cpp_matching_context()) then raise exception 'Complete settings opt-in denied'; end if; end $$;
update public.cpp_private_contacts set phone=null where user_id=auth.uid();
do $$ begin if exists(select 1 from public.cpp_matching_context()) or public.cpp_live_my_membership_id() is not null then raise exception 'Removed required field retains admission'; end if; end $$;
reset role;
do $$ begin if exists(select 1 from public.membership_members where user_id=current_setting('cpp.test_settings')::uuid and status='active') then raise exception 'Legacy LIVE access remains'; end if; end $$;

-- Profile saves and settings cannot remove an administrative restriction.
update public.membership_members set status='suspended' where user_id=current_setting('cpp.test_settings')::uuid;
set local role authenticated;
update public.cpp_private_contacts set phone='000-0000-0000' where user_id=auth.uid();
select public.cpp_begin_researcher_registration();
do $$ begin if exists(select 1 from public.cpp_matching_context()) then raise exception 'Suspension bypassed'; end if; end $$;
reset role;
update public.membership_members set status='ended' where user_id=current_setting('cpp.test_settings')::uuid;
set local role authenticated;
select public.cpp_set_alumni_participation('alumni');
select public.cpp_set_alumni_participation('researcher');
do $$ begin if exists(select 1 from public.cpp_matching_context()) then raise exception 'Termination bypassed'; end if; end $$;
reset role;
-- A company account must never be converted into a researcher by these paths.
update public.membership_members mm set status='active',organization_id=c.id,view_organization_id=r.id
from public.membership_organizations c,public.membership_organizations r
where mm.user_id=current_setting('cpp.test_settings')::uuid and c.membership_id=mm.membership_id and c.organization_key='CPP-C' and r.membership_id=mm.membership_id and r.organization_key='CPP-R';
set local role authenticated;
do $$ begin
 begin
  perform public.cpp_begin_researcher_registration();
  raise exception 'Company converted to researcher';
 exception when raise_exception then if sqlerrm='Company converted to researcher' then raise; end if; end;
 update public.cpp_profiles set public_name='企業のまま' where user_id=auth.uid();
 if not exists(select 1 from public.cpp_matching_context() where organization_key='CPP-C') then raise exception 'Company membership changed'; end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.cpp_begin_researcher_registration()','execute')
 or has_function_privilege('anon','public.cpp_researcher_registration_status()','execute')
 or has_function_privilege('authenticated','cpp_private.sync_researcher_membership(uuid)','execute') then raise exception 'Function access too broad'; end if;
end $$;
select true as researcher_registration_routes_passed;
rollback;
