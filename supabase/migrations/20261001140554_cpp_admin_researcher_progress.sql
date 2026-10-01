-- Read-only registration progress, available only in the current admin mode.
create function public.cpp_admin_researchers(p_search text default '',p_limit integer default 50,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform cpp_private.require_admin_mode();
 if p_limit is null or p_limit<1 or p_limit>100 or p_offset is null or p_offset<0
 or length(coalesce(p_search,''))>200 then
  raise exception '一覧の取得条件が正しくありません。' using errcode='22023';
 end if;
 with filtered as (
  select p.*,a.username::text,
   coalesce(nullif(btrim(p.public_name),''),nullif(btrim(a.display_name),''),nullif(a.username::text,''),'氏名未設定') display_name
  from public.cpp_profiles p left join public.profiles a on a.user_id=p.user_id
  where nullif(btrim(p_search),'') is null
   or strpos(lower(concat_ws(' ',p.public_name,a.display_name,a.username,p.affiliation)),lower(btrim(p_search)))>0
 ), page as (
  select * from filtered order by created_at,user_id limit p_limit offset p_offset
 ), progress as (
  select p.user_id,p.display_name,p.username,p.affiliation,p.created_at,p.updated_at,p.visibility,
   cpp_private.researcher_missing_fields(p.user_id) missing_fields,
   case when exists(select 1 from public.cpp_alumni a where a.user_id=p.user_id)
     and not exists(select 1 from cpp_private.alumni_participation a where a.user_id=p.user_id and a.choice='researcher')
     and not exists(select 1 from cpp_private.mode_users u where u.user_id=p.user_id)
    then true else false end alumni_only,
   case when p.research_evidence_deferred then 'deferred'
    when nullif(btrim(p.research_evidence),'') is not null then 'provided' else 'missing' end research_evidence_status,
   nullif(btrim(p.photo_path),'') is not null has_photo,
   (select count(*) from public.cpp_profile_research_fields f where f.user_id=p.user_id) research_field_count,
   (select count(*) from public.cpp_profile_keywords k where k.user_id=p.user_id and nullif(btrim(k.keyword),'') is not null) keyword_count,
   (select count(*) from public.cpp_profile_history h where h.user_id=p.user_id
     and (h.event_date is not null or h.start_year is not null or nullif(btrim(concat_ws('',h.event_text,h.organization,h.title,h.notes)),'') is not null)) history_count,
   (select count(*) from public.cpp_research_summaries s where s.user_id=p.user_id) summary_count,
   (select count(*) from public.cpp_research_summaries s where s.user_id=p.user_id and s.is_in_progress) summary_in_progress_count,
   (select count(*) from public.cpp_publications b where b.user_id=p.user_id and nullif(btrim(b.title),'') is not null) publication_count,
   nullif(btrim(p.self_appeal),'') is not null has_self_appeal
  from page p
 )
 select jsonb_build_object('total',(select count(*) from filtered),
  'members',coalesce((select jsonb_agg(to_jsonb(progress) order by created_at,user_id) from progress),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.cpp_admin_researchers(text,integer,integer) from public,anon;
grant execute on function public.cpp_admin_researchers(text,integer,integer) to authenticated;
notify pgrst,'reload schema';
