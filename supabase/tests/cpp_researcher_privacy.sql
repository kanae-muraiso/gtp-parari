begin;
do $$
declare researcher uuid; viewer uuid; membership uuid; company uuid; research_org uuid; company_org uuid; summary uuid; pdf text;
begin
 select user_id into researcher from public.profiles where username='kanae-muraiso';
 select p.user_id into viewer from public.profiles p where not public.cpp_is_staff(p.user_id) and not exists(select 1 from cpp_private.mode_users u where u.user_id=p.user_id) and p.user_id<>researcher limit 1;
 if viewer is null then raise exception 'Test viewer unavailable'; end if;
 select id into membership from public.memberships where name='CPP' and membership_mode='matching' order by created_at desc limit 1;
 select id into research_org from public.membership_organizations where membership_id=membership and organization_key='CPP-R';
 select id into company_org from public.membership_organizations where membership_id=membership and organization_key='CPP-C';
 insert into public.cpp_profiles(user_id,visibility) values(researcher,'published') on conflict(user_id) do update set visibility='published';
 insert into public.membership_members(membership_id,user_id,organization_id,view_organization_id,status) values(membership,researcher,research_org,company_org,'active'),(membership,viewer,company_org,research_org,'active') on conflict(membership_id,user_id) do update set organization_id=excluded.organization_id,view_organization_id=excluded.view_organization_id,status='active';
 insert into public.cpp_companies(created_by_user_id,name) values(viewer,'Privacy test rollback') returning id into company;
 insert into public.cpp_company_members(company_id,user_id,role) values(company,viewer,'owner');
 pdf:=researcher::text||'/privacy-test-'||gen_random_uuid()::text||'.pdf';
 insert into public.cpp_research_summaries(user_id,slot,title,pdf_path) select researcher,coalesce(max(slot),0)+1,'Rollback privacy test',pdf from public.cpp_research_summaries where user_id=researcher returning id into summary;
 insert into storage.objects(bucket_id,name) values('cpp-documents',pdf);
 perform set_config('cpp.test_researcher',researcher::text,true); perform set_config('cpp.test_viewer',viewer::text,true); perform set_config('cpp.test_company',company::text,true); perform set_config('cpp.test_summary',summary::text,true); perform set_config('cpp.test_pdf',pdf,true);
end $$;
select set_config('request.jwt.claim.sub',current_setting('cpp.test_viewer'),true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.cpp_profiles where user_id=current_setting('cpp.test_researcher')::uuid) or exists(select 1 from public.cpp_research_summaries where id=current_setting('cpp.test_summary')::uuid) then raise exception 'Unpaid viewer read details'; end if;
end $$;
reset role;
insert into cpp_private.company_researcher_access(company_id,payment_reference,verified_by,valid_until) values(current_setting('cpp.test_company')::uuid,'rollback-test',current_setting('cpp.test_researcher')::uuid,now()+interval '1 day');
set local role authenticated;
select set_config('storage.operation','object.get_authenticated',true);
do $$ begin
 if not exists(select 1 from public.cpp_profiles where user_id=current_setting('cpp.test_researcher')::uuid) or not exists(select 1 from public.cpp_research_summaries where id=current_setting('cpp.test_summary')::uuid) then raise exception 'Paid viewer denied'; end if;
 if not exists(select 1 from storage.objects where name=current_setting('cpp.test_pdf')) then raise exception 'Paid PDF download denied'; end if;
end $$;
select set_config('storage.operation','object.sign',true);
do $$ begin if exists(select 1 from storage.objects where name=current_setting('cpp.test_pdf')) then raise exception 'Viewer created shareable PDF token'; end if; end $$;
reset role;
update cpp_private.company_researcher_access set revoked_at=now() where company_id=current_setting('cpp.test_company')::uuid;
set local role authenticated;
do $$ begin if exists(select 1 from public.cpp_profiles where user_id=current_setting('cpp.test_researcher')::uuid) then raise exception 'Revoked company read details'; end if; end $$;
reset role;
update cpp_private.company_researcher_access set revoked_at=null where company_id=current_setting('cpp.test_company')::uuid;
update public.cpp_company_members set access_expires_at=now()-interval '1 day' where company_id=current_setting('cpp.test_company')::uuid;
set local role authenticated;
do $$ begin if exists(select 1 from public.cpp_profiles where user_id=current_setting('cpp.test_researcher')::uuid) then raise exception 'Expired company member read details'; end if; end $$;
reset role;
update public.cpp_company_members set access_expires_at=null where company_id=current_setting('cpp.test_company')::uuid;
update cpp_private.company_researcher_access set valid_until=now()-interval '1 day' where company_id=current_setting('cpp.test_company')::uuid;
set local role authenticated;
do $$ begin if exists(select 1 from public.cpp_profiles where user_id=current_setting('cpp.test_researcher')::uuid) then raise exception 'Expired viewer read details'; end if; end $$;
select set_config('request.jwt.claim.sub',current_setting('cpp.test_researcher'),true);
do $$ begin if not exists(select 1 from public.cpp_profiles where user_id=current_setting('cpp.test_researcher')::uuid) then raise exception 'Owner cannot edit'; end if; end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
 if exists(select 1 from public.cpp_profiles where user_id=current_setting('cpp.test_researcher')::uuid) or exists(select 1 from public.cpp_research_summaries where id=current_setting('cpp.test_summary')::uuid) or exists(select 1 from storage.objects where name=current_setting('cpp.test_pdf')) then raise exception 'Anonymous leak'; end if;
end $$;
select true as researcher_privacy_rules_passed;
rollback;
