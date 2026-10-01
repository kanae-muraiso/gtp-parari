-- Synthetic users and announcements are discarded at the end of the transaction.
begin;
select set_config('cpp.news_admin',gen_random_uuid()::text,true);
select set_config('cpp.news_researcher',gen_random_uuid()::text,true);
select set_config('cpp.news_alumni',gen_random_uuid()::text,true);
select set_config('cpp.news_company',gen_random_uuid()::text,true);
select set_config('cpp.news_baseline',count(*)::text,true) from public.cpp_researcher_announcements;
select set_config('cpp.news_published_baseline',count(*)::text,true) from public.cpp_researcher_announcements where status='published';
select set_config('cpp.news_alumni_baseline',count(*)::text,true) from public.cpp_alumni_announcements;
insert into auth.users(id,email) select current_setting(k)::uuid,current_setting(k)||'@example.invalid'
from unnest(array['cpp.news_admin','cpp.news_researcher','cpp.news_alumni','cpp.news_company']) k;
insert into cpp_private.mode_users(user_id,mode) values(current_setting('cpp.news_admin')::uuid,'admin');
-- Intentionally incomplete, unpublished profiles can read news.
insert into public.cpp_profiles(user_id) values(current_setting('cpp.news_researcher')::uuid),(current_setting('cpp.news_alumni')::uuid);
insert into public.cpp_alumni(user_id,cpp_memory) values(current_setting('cpp.news_alumni')::uuid,'news test');
insert into cpp_private.alumni_participation(user_id,choice) values(current_setting('cpp.news_alumni')::uuid,'alumni')
on conflict(user_id) do update set choice='alumni';

select set_config('request.jwt.claim.sub',current_setting('cpp.news_admin'),true);
set local role authenticated;
select set_config('cpp.news_draft',public.cpp_save_researcher_announcement('下書き','管理者だけが読む本文','draft')::text,true);
select set_config('cpp.news_live',public.cpp_save_researcher_announcement('公開','研究者向け本文','published',true)::text,true);
do $$ declare result jsonb; begin
 result:=public.cpp_researcher_news(true);
 if (result->>'total')::int<>current_setting('cpp.news_baseline')::int+2 or result->>'can_manage'<>'true' then raise exception 'Admin list incorrect'; end if;
 if (public.cpp_researcher_news(false)->>'total')::int<>current_setting('cpp.news_published_baseline')::int+1 then raise exception 'Draft in reader view'; end if;
 if not exists(select 1 from public.cpp_researcher_announcements where id=current_setting('cpp.news_draft')::uuid and published_at is null) then raise exception 'Draft timestamp incorrect'; end if;
 if not exists(select 1 from public.cpp_researcher_announcements where id=current_setting('cpp.news_live')::uuid and published_at is not null) then raise exception 'Publish timestamp missing'; end if;
 begin perform public.cpp_save_researcher_announcement(' ','本文','published'); raise exception 'Blank title accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.cpp_save_researcher_announcement('題名',repeat('a',10001),'draft'); raise exception 'Overlong body accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.cpp_save_researcher_announcement('題名','本文','invalid'); raise exception 'Invalid status accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.cpp_save_researcher_announcement('題名','本文','draft',false,gen_random_uuid()); raise exception 'Missing id accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.cpp_researcher_news(true,101); raise exception 'Unbounded page accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.cpp_researcher_news(null); raise exception 'Null manage accepted'; exception when invalid_parameter_value then null; end;
 begin insert into public.cpp_researcher_announcements(title,body) values('direct','write'); raise exception 'Direct write allowed'; exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub',current_setting('cpp.news_researcher'),true);
do $$ begin
 if (public.cpp_researcher_news()->>'total')::int<>current_setting('cpp.news_published_baseline')::int+1
   or public.cpp_researcher_news()->>'can_manage'<>'false' then raise exception 'Incomplete researcher cannot read'; end if;
 if exists(select 1 from public.cpp_researcher_announcements where status='draft') then raise exception 'RLS exposed draft'; end if;
 begin perform public.cpp_researcher_news(true); raise exception 'Researcher read management'; exception when insufficient_privilege then null; end;
 begin perform public.cpp_save_researcher_announcement('改変','本文','published',false,current_setting('cpp.news_draft')::uuid); raise exception 'Researcher modified draft'; exception when insufficient_privilege then null; end;
 begin update public.cpp_researcher_announcements set body='modified'; raise exception 'Direct update allowed'; exception when insufficient_privilege then null; end;
 begin delete from public.cpp_researcher_announcements; raise exception 'Direct delete allowed'; exception when insufficient_privilege then null; end;
end $$;

-- Stop publication, then edit and publish a draft through the actual API.
select set_config('request.jwt.claim.sub',current_setting('cpp.news_admin'),true);
select public.cpp_save_researcher_announcement('公開停止','研究者向け本文','draft',true,current_setting('cpp.news_live')::uuid);
select set_config('request.jwt.claim.sub',current_setting('cpp.news_researcher'),true);
do $$ begin
 if exists(select 1 from public.cpp_researcher_announcements where id=current_setting('cpp.news_live')::uuid)
   or (public.cpp_researcher_news()->>'total')::int<>current_setting('cpp.news_published_baseline')::int then raise exception 'Unpublished news still visible'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('cpp.news_admin'),true);
select public.cpp_save_researcher_announcement('編集して公開','更新本文','published',true,current_setting('cpp.news_draft')::uuid);
select set_config('request.jwt.claim.sub',current_setting('cpp.news_researcher'),true);
do $$ declare result jsonb; begin
 if not exists(select 1 from public.cpp_researcher_announcements where id=current_setting('cpp.news_draft')::uuid and title='編集して公開' and body='更新本文') then raise exception 'Edit/publish missing'; end if;
 result:=public.cpp_researcher_news(false,1,0);
 if jsonb_array_length(result->'items')<>1 or result->'items'->0->>'id'<>current_setting('cpp.news_draft') then raise exception 'Important/latest ordering incorrect'; end if;
 if exists(select 1 from jsonb_array_elements(public.cpp_researcher_news(false,100,1)->'items') x where x->>'id'=current_setting('cpp.news_draft')) then raise exception 'Pagination repeated item'; end if;
end $$;

select set_config('request.jwt.claim.sub',current_setting('cpp.news_alumni'),true);
do $$ begin
 begin perform public.cpp_researcher_news(); raise exception 'Alumni-only can read'; exception when insufficient_privilege then null; end;
 if exists(select 1 from public.cpp_researcher_announcements) then raise exception 'Alumni-only direct read'; end if;
end $$;
reset role;
update cpp_private.alumni_participation set choice='researcher' where user_id=current_setting('cpp.news_alumni')::uuid;
set local role authenticated;
do $$ begin
 if (public.cpp_researcher_news()->>'total')::int<>current_setting('cpp.news_published_baseline')::int+1 then raise exception 'Alumni plus researcher cannot read'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('cpp.news_company'),true);
do $$ begin
 begin perform public.cpp_researcher_news(); raise exception 'Non-researcher can read'; exception when insufficient_privilege then null; end;
 begin perform public.cpp_save_researcher_announcement('不正','本文','published'); raise exception 'Non-researcher can write'; exception when insufficient_privilege then null; end;
 if exists(select 1 from public.cpp_researcher_announcements) then raise exception 'Non-researcher direct read'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('cpp.news_admin'),true);
update cpp_private.mode_users set mode='company' where user_id=auth.uid();
set local role authenticated;
do $$ begin
 begin perform public.cpp_researcher_news(); raise exception 'Operator company mode can read'; exception when insufficient_privilege then null; end;
 begin perform public.cpp_save_researcher_announcement('不正','本文','published'); raise exception 'Operator company mode can write'; exception when insufficient_privilege then null; end;
 if exists(select 1 from public.cpp_researcher_announcements) then raise exception 'Operator company mode direct read'; end if;
end $$;
reset role;
update cpp_private.mode_users set mode='researcher' where user_id=auth.uid();
set local role authenticated;
do $$ begin
 perform public.cpp_researcher_news();
 begin perform public.cpp_researcher_news(true); raise exception 'Operator researcher mode manages'; exception when insufficient_privilege then null; end;
 begin perform public.cpp_save_researcher_announcement('不正','本文','published'); raise exception 'Operator researcher mode writes'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
 begin perform public.cpp_researcher_news(); raise exception 'Anon read'; exception when insufficient_privilege then null; end;
 begin perform public.cpp_save_researcher_announcement('不正','本文','published'); raise exception 'Anon write'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.cpp_researcher_announcements; raise exception 'Anon direct read'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.cpp_alumni_announcements)<>current_setting('cpp.news_alumni_baseline')::int then raise exception 'Alumni news changed'; end if;
end $$;
select true as researcher_announcements_passed;
rollback;
