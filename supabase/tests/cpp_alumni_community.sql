-- Community access, ownership, moderation, publication and pagination.
-- All accounts and content are transaction fixtures, never persistent test members.
begin;
select set_config('cpp.community_a',gen_random_uuid()::text,true);
select set_config('cpp.community_b',gen_random_uuid()::text,true);
select set_config('cpp.community_admin',gen_random_uuid()::text,true);
select set_config('cpp.community_outsider',gen_random_uuid()::text,true);
insert into auth.users(id,email) select current_setting(k)::uuid,current_setting(k)||'@example.invalid'
from unnest(array['cpp.community_a','cpp.community_b','cpp.community_admin','cpp.community_outsider']) k;
insert into public.cpp_alumni(user_id,participation_year,participation_location,cpp_memory)
values(current_setting('cpp.community_a')::uuid,2015,'東京','テストの思い出'),(current_setting('cpp.community_b')::uuid,2016,'大阪','テストの思い出');
insert into public.cpp_alumni_participations(user_id,participation_year,participation_location)
values(current_setting('cpp.community_a')::uuid,2015,'東京');
insert into public.parari_social_profiles(user_id,display_name,affiliation,intro)
values(current_setting('cpp.community_a')::uuid,'同窓会テストA','共通の所属','共通の自己紹介');
insert into cpp_private.mode_users(user_id,mode) values(current_setting('cpp.community_admin')::uuid,'admin');

select set_config('request.jwt.claim.sub',current_setting('cpp.community_a'),true);
set local role authenticated;
select set_config('cpp.community_post',public.cpp_alumni_save_update('近況を投稿します','https://www.parari.app/test/story')::text,true);
do $$ declare result jsonb; v_id uuid; begin
 result := public.cpp_alumni_community_context();
 if not (result->>'is_alumni')::boolean or (result->>'is_admin')::boolean then raise exception 'Wrong member context'; end if;
 result := public.cpp_alumni_community_members(current_setting('cpp.community_a')::uuid);
 if (result->>'total')::int<>1 or result->'members'->0->>'display_name'<>'同窓会テストA'
   or result->'members'->0->'participations'->0->>'location'<>'東京' then raise exception 'Member details lost'; end if;
 if result->'members'->0 ? 'research_evidence' or result->'members'->0 ? 'phone' or result->'members'->0 ? 'email' then raise exception 'Researcher/private contact leak'; end if;
 perform public.cpp_alumni_save_update('編集しました',null,current_setting('cpp.community_post')::uuid);
 result := public.cpp_alumni_feed(current_setting('cpp.community_a')::uuid,1,0);
 if result->'posts'->0->>'body'<>'編集しました' or (result->>'total')::int<>1 then raise exception 'Edit/feed failed'; end if;
 result := public.cpp_alumni_feed(current_setting('cpp.community_a')::uuid,1,1);
 if result->'posts'<>'[]'::jsonb or (result->>'total')::int<>1 then raise exception 'Pagination failed'; end if;
 v_id := public.cpp_alumni_save_update(repeat('😀',200));
 perform public.cpp_alumni_delete_update(v_id);
 begin perform public.cpp_alumni_save_update(repeat('あ',201)); raise exception 'Long body accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.cpp_alumni_save_update('  '); raise exception 'Empty body accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.cpp_alumni_save_update('近況','javascript:alert(1)'); raise exception 'Unsafe URL accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.cpp_alumni_save_update('近況','https://www.parari.app.evil.example/a'); raise exception 'Foreign URL accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.cpp_alumni_save_update('近況','https://www.parari.app/\evil'); raise exception 'Backslash URL accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.cpp_alumni_feed(null,0,0); raise exception 'Invalid limit accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.cpp_alumni_moderate_update(current_setting('cpp.community_post')::uuid,true); raise exception 'Member moderated'; exception when insufficient_privilege then null; end;
 begin perform public.cpp_alumni_save_announcement('偽お知らせ','本文','published'); raise exception 'Member published news'; exception when insufficient_privilege then null; end;
 begin perform public.cpp_alumni_news(true); raise exception 'Member read admin news'; exception when insufficient_privilege then null; end;
 begin update public.cpp_alumni_updates set user_id=current_setting('cpp.community_b')::uuid where id=current_setting('cpp.community_post')::uuid; raise exception 'Author forged'; exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub',current_setting('cpp.community_b'),true);
do $$ begin
 if not exists(select 1 from public.cpp_alumni_updates where id=current_setting('cpp.community_post')::uuid) then raise exception 'Alumni cannot read posts via RLS'; end if;
 begin perform public.cpp_alumni_save_update('書き換え',null,current_setting('cpp.community_post')::uuid); raise exception 'Edited another author'; exception when insufficient_privilege then null; end;
 begin perform public.cpp_alumni_delete_update(current_setting('cpp.community_post')::uuid); raise exception 'Deleted another author'; exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub',current_setting('cpp.community_admin'),true);
select public.cpp_alumni_moderate_update(current_setting('cpp.community_post')::uuid,true);
select set_config('cpp.community_news',public.cpp_alumni_save_announcement('テストのお知らせ','お知らせの本文','draft',true)::text,true);
do $$ declare result jsonb; begin
 if not (public.cpp_alumni_community_context()->>'is_admin')::boolean then raise exception 'Wrong admin context'; end if;
 result:=public.cpp_alumni_feed(current_setting('cpp.community_a')::uuid);
 if (result->>'total')::int<>1 or result->'posts'->0->>'hidden_at' is null then raise exception 'Admin lost hidden post'; end if;
 if not exists(select 1 from public.cpp_alumni_announcements where id=current_setting('cpp.community_news')::uuid and status='draft') then raise exception 'Draft not saved'; end if;
 if exists(select 1 from jsonb_array_elements(public.cpp_alumni_news(false,100)->'items') x where x->>'id'=current_setting('cpp.community_news')) then raise exception 'Draft appeared in community news'; end if;
 perform public.cpp_alumni_community_members(current_setting('cpp.community_a')::uuid);
end $$;
select public.cpp_set_mode('company');
do $$ begin
 begin perform public.cpp_alumni_news(true); raise exception 'Company mode admin access'; exception when insufficient_privilege then null; end;
 begin perform public.cpp_alumni_feed(); raise exception 'Nonalumni operator saw feed'; exception when insufficient_privilege then null; end;
end $$;
select public.cpp_set_mode('researcher');
do $$ begin
 begin perform public.cpp_alumni_save_announcement('見出し','本文','published'); raise exception 'Researcher mode admin access'; exception when insufficient_privilege then null; end;
end $$;
select public.cpp_set_mode('admin');

select set_config('request.jwt.claim.sub',current_setting('cpp.community_a'),true);
do $$ begin
 if exists(select 1 from public.cpp_alumni_updates where id=current_setting('cpp.community_post')::uuid) then raise exception 'Hidden post leaked via RLS'; end if;
 if (public.cpp_alumni_feed(auth.uid())->>'total')::int<>0 then raise exception 'Hidden post leaked via feed'; end if;
 if exists(select 1 from public.cpp_alumni_announcements where id=current_setting('cpp.community_news')::uuid) then raise exception 'Draft leaked via RLS'; end if;
 perform public.cpp_alumni_save_update('編集しても非表示のまま',null,current_setting('cpp.community_post')::uuid);
 if (public.cpp_alumni_feed(auth.uid())->>'total')::int<>0 then raise exception 'Author bypassed moderation'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('cpp.community_admin'),true);
select public.cpp_alumni_moderate_update(current_setting('cpp.community_post')::uuid,false);
select public.cpp_alumni_save_announcement('テストのお知らせ','公開本文','published',true,current_setting('cpp.community_news')::uuid);
select set_config('request.jwt.claim.sub',current_setting('cpp.community_b'),true);
do $$ begin
 if not exists(select 1 from public.cpp_alumni_announcements where id=current_setting('cpp.community_news')::uuid and published_at is not null) then raise exception 'Published news unreadable'; end if;
 if (public.cpp_alumni_feed(current_setting('cpp.community_a')::uuid)->>'total')::int<>1 then raise exception 'Restored post missing'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('cpp.community_admin'),true);
select public.cpp_alumni_save_announcement('テストのお知らせ','公開本文','draft',false,current_setting('cpp.community_news')::uuid);
select set_config('request.jwt.claim.sub',current_setting('cpp.community_b'),true);
do $$ begin
 if exists(select 1 from public.cpp_alumni_announcements where id=current_setting('cpp.community_news')::uuid) then raise exception 'Unpublished news still visible'; end if;
end $$;

select set_config('request.jwt.claim.sub',current_setting('cpp.community_outsider'),true);
do $$ begin
 if exists(select 1 from public.cpp_alumni_updates) or exists(select 1 from public.cpp_alumni_announcements) then raise exception 'Nonalumni RLS leak'; end if;
 begin perform public.cpp_alumni_feed(); raise exception 'Nonalumni feed access'; exception when insufficient_privilege then null; end;
 begin perform public.cpp_alumni_community_members(); raise exception 'Nonalumni directory access'; exception when insufficient_privilege then null; end;
 begin perform public.cpp_alumni_news(); raise exception 'Nonalumni news access'; exception when insufficient_privilege then null; end;
 begin perform public.cpp_alumni_save_update('侵入'); raise exception 'Nonalumni posted'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('cpp.community_a'),true);
select public.cpp_alumni_delete_update(current_setting('cpp.community_post')::uuid);
do $$ begin
 if (public.cpp_alumni_feed(auth.uid())->>'total')::int<>0 then raise exception 'Deletion did not reach feed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
   and p.proname in ('cpp_alumni_community_context','cpp_alumni_community_members','cpp_alumni_feed','cpp_alumni_save_update','cpp_alumni_delete_update','cpp_alumni_moderate_update','cpp_alumni_news','cpp_alumni_save_announcement')
   and has_function_privilege('anon',p.oid,'execute')) then raise exception 'Anonymous RPC grant'; end if;
 begin perform public.cpp_alumni_feed(); raise exception 'Anonymous feed access'; exception when insufficient_privilege then null; end;
end $$;
select true as alumni_community_permissions_and_flows_passed;
rollback;
