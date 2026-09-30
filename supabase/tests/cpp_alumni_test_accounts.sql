-- Run inside a transaction; all fixtures and profile/membership edits are rolled back.
begin;
select set_config('cpp.test_owner',gen_random_uuid()::text,true);
select set_config('cpp.test_user',gen_random_uuid()::text,true);
select set_config('cpp.test_other',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_app_meta_data) values
 (current_setting('cpp.test_owner')::uuid,'owner-'||current_setting('cpp.test_owner')||'@example.invalid','{}'),
 (current_setting('cpp.test_user')::uuid,'test-'||current_setting('cpp.test_user')||'@example.invalid',jsonb_build_object('cpp_test_owner',current_setting('cpp.test_owner'))),
 (current_setting('cpp.test_other')::uuid,'other-'||current_setting('cpp.test_other')||'@example.invalid','{}');
insert into cpp_private.mode_users(user_id,mode) values(current_setting('cpp.test_owner')::uuid,'admin');
select set_config('request.jwt.claim.sub',current_setting('cpp.test_owner'),true);
set local role authenticated;
do $$ begin
 if has_function_privilege('anon','public.cpp_prepare_alumni_test(uuid,text)','execute') then raise exception 'Anonymous access'; end if;
 begin
  perform public.cpp_prepare_alumni_test(current_setting('cpp.test_other')::uuid,'alumni');
  raise exception 'Arbitrary account accepted';
 exception when insufficient_privilege then null; end;
 begin
  perform public.cpp_prepare_alumni_test(current_setting('cpp.test_owner')::uuid,'alumni');
  raise exception 'Owner account accepted';
 exception when insufficient_privilege then null; end;
 perform public.cpp_prepare_alumni_test(current_setting('cpp.test_user')::uuid,'alumni');
 if public.cpp_alumni_test_account()<>current_setting('cpp.test_user')::uuid then raise exception 'Wrong account mapping'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('cpp.test_user'),true);
do $$ begin
 if exists(select 1 from public.cpp_mode_status()) then raise exception 'Test user has operator role'; end if;
 if not exists(select 1 from public.cpp_alumni_participation_status() where is_alumni and choice='alumni' and not admitted and not is_operator) then raise exception 'Wrong alumni status'; end if;
 if exists(select 1 from public.cpp_matching_context()) or public.cpp_live_my_membership_id() is not null then raise exception 'Alumni has matching access'; end if;
 begin
  perform public.cpp_alumni_test_account();
  raise exception 'Test user accessed admin RPC';
 exception when insufficient_privilege then null; end;
 begin
  perform public.cpp_prepare_alumni_test(current_setting('cpp.test_user')::uuid,'researcher_approved');
  raise exception 'Test user self-approved';
 exception when insufficient_privilege then null; end;
 perform public.cpp_set_alumni_participation('researcher');
 if exists(select 1 from public.cpp_matching_context()) then raise exception 'Choice granted approval'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('cpp.test_owner'),true);
select public.cpp_prepare_alumni_test(current_setting('cpp.test_user')::uuid,'researcher_pending');
select set_config('request.jwt.claim.sub',current_setting('cpp.test_user'),true);
do $$ begin if exists(select 1 from public.cpp_matching_context()) then raise exception 'Pending researcher admitted'; end if; end $$;
select set_config('request.jwt.claim.sub',current_setting('cpp.test_owner'),true);
select public.cpp_prepare_alumni_test(current_setting('cpp.test_user')::uuid,'researcher_approved');
select set_config('request.jwt.claim.sub',current_setting('cpp.test_user'),true);
do $$ begin
 if not exists(select 1 from public.cpp_matching_context() where organization_key='CPP-R' and view_organization_key='CPP-C') then raise exception 'Approved researcher denied'; end if;
 if cpp_security.can_read_researcher(current_setting('cpp.test_other')::uuid) then raise exception 'Researcher can read another researcher'; end if;
end $$;
update public.cpp_profiles set visibility='published' where user_id=auth.uid();
select public.cpp_set_alumni_participation('alumni');
do $$ begin
 if not exists(select 1 from public.cpp_profiles where user_id=auth.uid() and visibility='draft') then raise exception 'Profile not retained as draft'; end if;
 if exists(select 1 from public.cpp_matching_context()) then raise exception 'Opt-out did not revoke access'; end if;
 begin
  update public.cpp_profiles set visibility='published' where user_id=auth.uid();
  raise exception 'Opt-out profile publication accepted';
 exception when raise_exception then
  if sqlerrm='Opt-out profile publication accepted' then raise; end if;
 end;
end $$;
select public.cpp_set_alumni_participation('researcher');
do $$ begin if not exists(select 1 from public.cpp_matching_context()) then raise exception 'Previous approval not resumed'; end if; end $$;
select public.cpp_live_enter_as(5,'available');
do $$ begin
 begin
  perform public.cpp_set_alumni_participation('alumni');
  raise exception 'LIVE switch accepted';
 exception when raise_exception then
  if sqlerrm='LIVE switch accepted' then raise; end if;
 end;
end $$;
select public.cpp_live_leave();
select public.cpp_set_alumni_participation('alumni');
select set_config('request.jwt.claim.sub',current_setting('cpp.test_owner'),true);
select public.cpp_set_mode('researcher');
do $$ begin
 begin
  perform public.cpp_prepare_alumni_test(current_setting('cpp.test_user')::uuid,'alumni');
  raise exception 'Non-admin operator prepared test';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
