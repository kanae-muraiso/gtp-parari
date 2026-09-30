-- All fixtures and saves are rolled back; no real member data is changed.
begin;
select set_config('cpp.evidence_admin',gen_random_uuid()::text,true);
select set_config('cpp.evidence_member',gen_random_uuid()::text,true);
select set_config('cpp.evidence_other',gen_random_uuid()::text,true);
select set_config('cpp.evidence_search','evidence-'||gen_random_uuid()::text,true);
insert into auth.users(id,email) select current_setting(k)::uuid,current_setting(k)||'@example.invalid'
from unnest(array['cpp.evidence_admin','cpp.evidence_member','cpp.evidence_other']) k;
insert into cpp_private.mode_users(user_id,mode) values(current_setting('cpp.evidence_admin')::uuid,'admin');
insert into public.cpp_profiles(user_id,public_name,affiliation,created_at,research_evidence_updated_at)
values(current_setting('cpp.evidence_member')::uuid,current_setting('cpp.evidence_search')||' 1','確認大学','2026-01-01',now()),
 (current_setting('cpp.evidence_other')::uuid,current_setting('cpp.evidence_search')||' 2','確認研究所','2026-01-02',null);
select set_config('request.jwt.claim.sub',current_setting('cpp.evidence_admin'),true);
set local role authenticated;
do $$ declare result jsonb; begin
 result:=public.cpp_admin_deferred_research_evidence(current_setting('cpp.evidence_search'),1,0);
 if (result->>'total')::int<>2 or jsonb_array_length(result->'members')<>1
 or result->'members'->0->>'user_id'<>current_setting('cpp.evidence_member') then raise exception 'Wrong count or first page'; end if;
 if result->'members'->0 ? 'email' or result->'members'->0 ? 'phone' or result->'members'->0 ? 'address' then raise exception 'Queue contains unnecessary contact fields'; end if;
 result:=public.cpp_admin_deferred_research_evidence(current_setting('cpp.evidence_search'),1,1);
 if result->'members'->0->>'user_id'<>current_setting('cpp.evidence_other') then raise exception 'Wrong second page'; end if;
 result:=public.cpp_admin_deferred_research_evidence(current_setting('cpp.evidence_search'),1,2);
 if (result->>'total')::int<>2 or jsonb_array_length(result->'members')<>0 then raise exception 'Wrong empty page'; end if;
 result:=public.cpp_admin_deferred_research_evidence(current_setting('cpp.evidence_search')||' absent',50,0);
 if (result->>'total')::int<>0 or result->'members'<>'[]'::jsonb then raise exception 'Search filter failed'; end if;
 begin
  perform public.cpp_admin_deferred_research_evidence('',101,0);
  raise exception 'Invalid pagination accepted';
 exception when invalid_parameter_value then null; end;
end $$;
-- Being a mode operator is insufficient while in researcher/company mode.
select public.cpp_set_mode('researcher');
do $$ begin
 begin perform public.cpp_admin_deferred_research_evidence(); raise exception 'Researcher mode admitted'; exception when insufficient_privilege then null; end;
end $$;
select public.cpp_set_mode('company');
do $$ begin
 begin perform public.cpp_admin_deferred_research_evidence(); raise exception 'Company mode admitted'; exception when insufficient_privilege then null; end;
end $$;
select public.cpp_set_mode('admin');

-- A member can update only their own evidence, using the same fields as registration.
select set_config('request.jwt.claim.sub',current_setting('cpp.evidence_member'),true);
do $$ declare affected integer; begin
 begin perform public.cpp_admin_deferred_research_evidence(); raise exception 'Ordinary member admitted'; exception when insufficient_privilege then null; end;
 update public.cpp_profiles set research_evidence='https://example.org/unauthorized',research_evidence_deferred=false where user_id=current_setting('cpp.evidence_other')::uuid;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Member modified another profile'; end if;
 begin
  update public.cpp_profiles set research_evidence='  ',research_evidence_deferred=false where user_id=auth.uid();
  raise exception 'Empty evidence accepted without deferral';
 exception when check_violation then null; end;
end $$;
update public.cpp_profiles set research_evidence='https://example.org/research-profile',research_evidence_deferred=false,research_evidence_updated_at=now() where user_id=auth.uid();
do $$ begin
 if not exists(select 1 from public.cpp_profiles where user_id=auth.uid() and research_evidence='https://example.org/research-profile' and not research_evidence_deferred and research_evidence_updated_at is not null) then raise exception 'Own evidence did not persist'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('cpp.evidence_admin'),true);
do $$ declare result jsonb; begin
 result:=public.cpp_admin_deferred_research_evidence(current_setting('cpp.evidence_search'),50,0);
 if (result->>'total')::int<>1 or result->'members'->0->>'user_id'<>current_setting('cpp.evidence_other') then raise exception 'Submitted member remains in queue'; end if;
end $$;
-- Choosing later again returns the member to the queue, without changing publication.
select set_config('request.jwt.claim.sub',current_setting('cpp.evidence_member'),true);
update public.cpp_profiles set research_evidence=null,research_evidence_deferred=true,research_evidence_updated_at=now() where user_id=auth.uid();
select set_config('request.jwt.claim.sub',current_setting('cpp.evidence_admin'),true);
do $$ declare result jsonb; begin
 result:=public.cpp_admin_deferred_research_evidence(current_setting('cpp.evidence_search'),50,0);
 if (result->>'total')::int<>2 then raise exception 'Deferred member did not return'; end if;
 if not exists(select 1 from public.cpp_profiles where user_id=current_setting('cpp.evidence_member')::uuid and visibility='draft') then raise exception 'Evidence save changed publication'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
 if has_function_privilege('anon','public.cpp_admin_deferred_research_evidence(text,integer,integer)','execute') then raise exception 'Anonymous grant'; end if;
 begin perform public.cpp_admin_deferred_research_evidence(); raise exception 'Anonymous queue access'; exception when insufficient_privilege then null; end;
end $$;
select true as evidence_queue_and_permissions_passed;
rollback;
