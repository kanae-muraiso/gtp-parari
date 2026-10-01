-- All fixtures, including publication changes, are rolled back.
begin;
select set_config('cpp.progress_admin',gen_random_uuid()::text,true);
select set_config('cpp.progress_empty',gen_random_uuid()::text,true);
select set_config('cpp.progress_complete',gen_random_uuid()::text,true);
select set_config('cpp.progress_search','progress-'||gen_random_uuid()::text,true);
insert into auth.users(id,email)
select current_setting(k)::uuid,current_setting(k)||'@example.invalid'
from unnest(array['cpp.progress_admin','cpp.progress_empty','cpp.progress_complete']) k;
insert into cpp_private.mode_users(user_id,mode) values(current_setting('cpp.progress_admin')::uuid,'admin');
insert into public.profiles(user_id,display_name)
values(current_setting('cpp.progress_empty')::uuid,current_setting('cpp.progress_search')||' empty');
insert into public.cpp_profiles(user_id,created_at,research_evidence_deferred)
values(current_setting('cpp.progress_empty')::uuid,'2001-01-01',true);
insert into public.cpp_profiles(user_id,public_name,created_at,degree_status,degree_level,degree_institution,degree_date,visibility,research_evidence,research_evidence_deferred)
values(current_setting('cpp.progress_complete')::uuid,current_setting('cpp.progress_search')||' complete',
 '2002-01-01','obtained','doctorate','Fixture university','2000-03-31','published','Private evidence not returned',false);
insert into public.cpp_private_contacts(user_id,email,phone,address)
values(current_setting('cpp.progress_complete')::uuid,'not-returned@example.invalid','do-not-expose-phone','do-not-expose-address');
insert into public.cpp_research_summaries(user_id,slot,is_in_progress)
values(current_setting('cpp.progress_complete')::uuid,1,true);
insert into public.cpp_profile_keywords(user_id,keyword)
values(current_setting('cpp.progress_complete')::uuid,'fixture keyword');
insert into public.cpp_profile_history(user_id,kind,event_text)
values(current_setting('cpp.progress_complete')::uuid,'education','Fixture university');
insert into public.cpp_profile_history(user_id,kind)
values(current_setting('cpp.progress_complete')::uuid,'career');

select set_config('request.jwt.claim.sub',current_setting('cpp.progress_admin'),true);
set local role authenticated;
do $$ declare result jsonb; row jsonb; begin
 result:=public.cpp_admin_researchers(current_setting('cpp.progress_search'));
 if (result->>'total')::int<>2 or jsonb_array_length(result->'members')<>2 then raise exception 'Missing registrations'; end if;
 if result->'members'->0->>'user_id'<>current_setting('cpp.progress_empty')
  or result->'members'->1->>'user_id'<>current_setting('cpp.progress_complete') then raise exception 'Wrong registration order'; end if;
 row:=result->'members'->0;
 if jsonb_array_length(row->'missing_fields')<>8 or row->>'visibility'<>'draft'
  or row->>'research_evidence_status'<>'deferred' then raise exception 'Incomplete profile status incorrect'; end if;
 row:=result->'members'->1;
 if row->'missing_fields'<>'[]'::jsonb or row->>'visibility'<>'published'
  or row->>'research_evidence_status'<>'provided' or (row->>'summary_count')::int<>1
  or (row->>'summary_in_progress_count')::int<>1 or (row->>'keyword_count')::int<>1
  or (row->>'history_count')::int<>1 then raise exception 'Saved progress incorrect'; end if;
 if row ? 'email' or row ? 'phone' or row ? 'address' or row ? 'research_evidence'
  or result::text like '%do-not-expose-%' or result::text like '%Private evidence not returned%'
 then raise exception 'Private contents returned'; end if;
 result:=public.cpp_admin_researchers(current_setting('cpp.progress_search'),1,1);
 if (result->>'total')::int<>2 or jsonb_array_length(result->'members')<>1
  or result->'members'->0->>'user_id'<>current_setting('cpp.progress_complete') then raise exception 'Pagination failed'; end if;
 if (public.cpp_admin_researchers(current_setting('cpp.progress_search')||' complete')->>'total')::int<>1 then raise exception 'Search failed'; end if;
 if (public.cpp_admin_researchers(current_setting('cpp.progress_search'),1,2)->'members')<>'[]'::jsonb then raise exception 'End of page failed'; end if;
 begin perform public.cpp_admin_researchers('',0,0); raise exception 'Invalid limit accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.cpp_admin_researchers('',50,-1); raise exception 'Invalid offset accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.cpp_admin_researchers(repeat('x',201)); raise exception 'Oversized search accepted'; exception when invalid_parameter_value then null; end;
end $$;
select public.cpp_set_mode('researcher');
do $$ begin
 begin perform public.cpp_admin_researchers(); raise exception 'Researcher mode read admin list'; exception when insufficient_privilege then null; end;
end $$;
select public.cpp_set_mode('company');
do $$ begin
 begin perform public.cpp_admin_researchers(); raise exception 'Company mode read admin list'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('cpp.progress_complete'),true);
do $$ begin
 begin perform public.cpp_admin_researchers(); raise exception 'Ordinary member read admin list'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
 begin perform public.cpp_admin_researchers(); raise exception 'Anonymous read admin list'; exception when insufficient_privilege then null; end;
end $$;
select true as admin_researcher_progress_passed;
rollback;
