-- Researchers may read published company profiles without a company payment.
begin;
select set_config('cpp.company_reader',gen_random_uuid()::text,true);
select set_config('cpp.company_contact',gen_random_uuid()::text,true);
insert into auth.users(id,email)
select current_setting(k)::uuid,current_setting(k)||'@example.invalid'
from unnest(array['cpp.company_reader','cpp.company_contact']) k;
insert into public.cpp_profiles(user_id,public_name,degree_status,degree_level,degree_institution,degree_date)
values(current_setting('cpp.company_reader')::uuid,'Rollback researcher','obtained','doctorate','Fixture university','2000-03-31');
insert into public.cpp_private_contacts(user_id,email,phone,address)
values(current_setting('cpp.company_reader')::uuid,'fixture@example.invalid','000','Fixture');
do $$ declare mid uuid; r uuid; c uuid; cid uuid; begin
 select id into mid from public.memberships where name='CPP' and membership_mode='matching' order by created_at desc limit 1;
 select id into r from public.membership_organizations where membership_id=mid and organization_key='CPP-R';
 select id into c from public.membership_organizations where membership_id=mid and organization_key='CPP-C';
 insert into public.membership_members(membership_id,user_id,organization_id,view_organization_id,status)
 values(mid,current_setting('cpp.company_contact')::uuid,c,r,'active');
 insert into public.cpp_companies(created_by_user_id,name,visibility)
 values(current_setting('cpp.company_contact')::uuid,'Rollback company','draft') returning id into cid;
 insert into public.cpp_company_members(company_id,user_id,role)
 values(cid,current_setting('cpp.company_contact')::uuid,'owner');
 perform set_config('cpp.company_id',cid::text,true);
end $$;
select set_config('request.jwt.claim.sub',current_setting('cpp.company_reader'),true);
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.cpp_matching_member_social_profile(current_setting('cpp.company_contact')::uuid)
  where can_view_deep and deep_kind='company' and deep_target_id=current_setting('cpp.company_id')::uuid)
 then raise exception 'Researcher cannot resolve company detail link'; end if;
 if exists(select 1 from public.cpp_companies where id=current_setting('cpp.company_id')::uuid)
 then raise exception 'Company draft leaked to researcher'; end if;
end $$;
reset role;
update public.cpp_companies set visibility='published' where id=current_setting('cpp.company_id')::uuid;
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.cpp_companies where id=current_setting('cpp.company_id')::uuid and visibility='published')
 then raise exception 'Published company requires researcher payment'; end if;
end $$;
reset role;
insert into cpp_private.mode_users(user_id,mode) values(current_setting('cpp.company_reader')::uuid,'researcher');
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.cpp_matching_member_social_profile(current_setting('cpp.company_contact')::uuid)
  where can_view_deep and deep_kind='company')
  or not exists(select 1 from public.cpp_companies where id=current_setting('cpp.company_id')::uuid and visibility='published')
 then raise exception 'Operator researcher mode cannot read published company'; end if;
end $$;
select true as company_browse_access_passed;
rollback;
