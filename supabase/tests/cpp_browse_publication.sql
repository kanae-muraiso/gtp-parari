-- Test accounts and memberships exist only inside this rolled-back transaction.
begin;
select set_config('cpp.browse_operator',gen_random_uuid()::text,true);
select set_config('cpp.browse_company_user',gen_random_uuid()::text,true);
select set_config('cpp.browse_draft',gen_random_uuid()::text,true);
select set_config('cpp.browse_published',gen_random_uuid()::text,true);
select set_config('cpp.browse_missing',gen_random_uuid()::text,true);
select set_config('cpp.browse_outsider',gen_random_uuid()::text,true);
insert into auth.users(id,email)
select current_setting(k)::uuid,current_setting(k)||'@example.invalid'
from unnest(array['cpp.browse_operator','cpp.browse_company_user','cpp.browse_draft',
  'cpp.browse_published','cpp.browse_missing','cpp.browse_outsider']) k;
insert into cpp_private.mode_users(user_id,mode)
values(current_setting('cpp.browse_operator')::uuid,'company');
insert into public.cpp_profiles(user_id,visibility)
values(current_setting('cpp.browse_draft')::uuid,'draft'),
  (current_setting('cpp.browse_published')::uuid,'published');
insert into public.parari_social_profiles(user_id,display_name)
values(current_setting('cpp.browse_draft')::uuid,'Draft rollback fixture'),
  (current_setting('cpp.browse_published')::uuid,'Published rollback fixture'),
  (current_setting('cpp.browse_missing')::uuid,'No workbook rollback fixture');
do $$ declare membership uuid; r uuid; c uuid; company uuid; begin
 select id into membership from public.memberships
 where name='CPP' and membership_mode='matching' order by created_at desc limit 1;
 select id into r from public.membership_organizations where membership_id=membership and organization_key='CPP-R';
 select id into c from public.membership_organizations where membership_id=membership and organization_key='CPP-C';
 insert into public.membership_members(membership_id,user_id,organization_id,view_organization_id,status)
 values(membership,current_setting('cpp.browse_company_user')::uuid,c,r,'active'),
   (membership,current_setting('cpp.browse_draft')::uuid,r,c,'active'),
   (membership,current_setting('cpp.browse_published')::uuid,r,c,'active'),
   (membership,current_setting('cpp.browse_missing')::uuid,r,c,'active')
 on conflict(membership_id,user_id) do update set organization_id=excluded.organization_id,
   view_organization_id=excluded.view_organization_id,status='active';
 insert into public.cpp_companies(created_by_user_id,name)
 values(current_setting('cpp.browse_company_user')::uuid,'Browse rollback fixture') returning id into company;
 insert into public.cpp_company_members(company_id,user_id,role)
 values(company,current_setting('cpp.browse_company_user')::uuid,'owner');
 perform set_config('cpp.browse_company',company::text,true);
end $$;

select set_config('request.jwt.claim.sub',current_setting('cpp.browse_operator'),true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.cpp_matching_visible_members()
   where user_id in (current_setting('cpp.browse_draft')::uuid,current_setting('cpp.browse_missing')::uuid))
 then raise exception 'Unpublished researcher leaked in company-mode BROWSE'; end if;
 if exists(select 1 from public.cpp_matching_member_social_profile(current_setting('cpp.browse_draft')::uuid))
   or exists(select 1 from public.cpp_matching_member_social_profile(current_setting('cpp.browse_missing')::uuid))
 then raise exception 'Unpublished researcher leaked through direct member URL'; end if;
 if not exists(select 1 from public.cpp_matching_visible_members() where user_id=current_setting('cpp.browse_published')::uuid)
   or not exists(select 1 from public.cpp_matching_member_social_profile(current_setting('cpp.browse_published')::uuid))
 then raise exception 'Published researcher missing for operator company mode'; end if;
 if exists(select 1 from public.cpp_profiles where user_id=current_setting('cpp.browse_draft')::uuid)
 then raise exception 'Operator company mode read draft details'; end if;
end $$;
select public.cpp_set_mode('researcher');
do $$ begin
 if exists(select 1 from public.cpp_matching_visible_members() where organization_key='CPP-R')
   or exists(select 1 from public.cpp_matching_member_social_profile(current_setting('cpp.browse_published')::uuid))
 then raise exception 'Researcher mode read researcher BROWSE profiles'; end if;
 if not exists(select 1 from public.cpp_matching_visible_members() where user_id=current_setting('cpp.browse_company_user')::uuid)
 then raise exception 'Researcher mode lost company BROWSE'; end if;
end $$;
select public.cpp_set_mode('admin');
do $$ begin
 if not exists(select 1 from public.cpp_profiles where user_id=current_setting('cpp.browse_draft')::uuid)
 then raise exception 'Admin mode lost draft inspection'; end if;
end $$;

select set_config('request.jwt.claim.sub',current_setting('cpp.browse_company_user'),true);
do $$ begin
 if exists(select 1 from public.cpp_matching_visible_members() where organization_key='CPP-R')
   or exists(select 1 from public.cpp_matching_member_social_profile(current_setting('cpp.browse_published')::uuid))
 then raise exception 'Unpaid company accessed researcher BROWSE'; end if;
end $$;
reset role;
insert into cpp_private.company_researcher_access(company_id,payment_reference,verified_by,valid_until)
values(current_setting('cpp.browse_company')::uuid,'rollback-test',current_setting('cpp.browse_operator')::uuid,now()+interval '1 day');
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.cpp_matching_visible_members() where user_id=current_setting('cpp.browse_published')::uuid)
   or not exists(select 1 from public.cpp_matching_member_social_profile(current_setting('cpp.browse_published')::uuid))
 then raise exception 'Paid company lost published researcher'; end if;
 if exists(select 1 from public.cpp_matching_visible_members() where user_id=current_setting('cpp.browse_draft')::uuid)
   or exists(select 1 from public.cpp_matching_member_social_profile(current_setting('cpp.browse_draft')::uuid))
 then raise exception 'Paid company accessed draft researcher'; end if;
end $$;
reset role;
update public.cpp_profiles set visibility='draft' where user_id=current_setting('cpp.browse_published')::uuid;
set local role authenticated;
do $$ begin
 if exists(select 1 from public.cpp_matching_visible_members() where user_id=current_setting('cpp.browse_published')::uuid)
   or exists(select 1 from public.cpp_matching_member_social_profile(current_setting('cpp.browse_published')::uuid))
 then raise exception 'Unpublishing did not remove BROWSE and direct access'; end if;
end $$;
reset role;
update public.cpp_profiles set visibility='published' where user_id=current_setting('cpp.browse_published')::uuid;
update cpp_private.company_researcher_access set revoked_at=now() where company_id=current_setting('cpp.browse_company')::uuid;
set local role authenticated;
do $$ begin
 if exists(select 1 from public.cpp_matching_visible_members() where organization_key='CPP-R')
   or exists(select 1 from public.cpp_matching_member_social_profile(current_setting('cpp.browse_published')::uuid))
 then raise exception 'Revoked company retained BROWSE access'; end if;
end $$;
reset role;
update cpp_private.company_researcher_access set revoked_at=null,valid_until=now()-interval '1 day' where company_id=current_setting('cpp.browse_company')::uuid;
set local role authenticated;
do $$ begin
 if exists(select 1 from public.cpp_matching_visible_members() where organization_key='CPP-R')
 then raise exception 'Expired company retained BROWSE access'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('cpp.browse_outsider'),true);
do $$ begin
 if exists(select 1 from public.cpp_matching_visible_members())
   or exists(select 1 from public.cpp_matching_member_social_profile(current_setting('cpp.browse_published')::uuid))
 then raise exception 'Nonmember accessed BROWSE'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
 begin perform public.cpp_matching_visible_members(); raise exception 'Anonymous BROWSE RPC granted';
 exception when insufficient_privilege then null; end;
 begin perform public.cpp_matching_member_social_profile(current_setting('cpp.browse_published')::uuid);
 raise exception 'Anonymous member RPC granted'; exception when insufficient_privilege then null; end;
end $$;
select true as browse_publication_tests_passed;
rollback;
