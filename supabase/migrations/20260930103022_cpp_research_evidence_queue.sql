-- The queue exposes only the fields needed to identify deferred researchers.
-- Both the role grant and current administrator mode are checked on every call.
create function public.cpp_admin_deferred_research_evidence(p_search text default '',p_limit integer default 50,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform cpp_private.require_admin_mode();
 if p_limit is null or p_limit<1 or p_limit>100 or p_offset is null or p_offset<0
 or length(coalesce(p_search,''))>200 then raise exception '一覧の取得条件が正しくありません。' using errcode='22023'; end if;
 with filtered as (
  select p.user_id,coalesce(nullif(btrim(p.public_name),''),nullif(btrim(a.display_name),''),nullif(a.username::text,''),'氏名未設定') as display_name,
   a.username::text as username,p.affiliation,p.visibility,p.created_at,p.research_evidence_updated_at
  from public.cpp_profiles p left join public.profiles a on a.user_id=p.user_id
  where p.research_evidence_deferred
   and (nullif(btrim(p_search),'') is null or strpos(lower(concat_ws(' ',p.public_name,a.display_name,a.username,p.affiliation)),lower(btrim(p_search)))>0)
 ), page as (
  select * from filtered order by created_at,user_id limit p_limit offset p_offset
 )
 select jsonb_build_object('total',(select count(*) from filtered),
  'members',coalesce((select jsonb_agg(to_jsonb(page) order by created_at,user_id) from page),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.cpp_admin_deferred_research_evidence(text,integer,integer) from public,anon;
grant execute on function public.cpp_admin_deferred_research_evidence(text,integer,integer) to authenticated;
notify pgrst,'reload schema';
