create or replace function public.cpp_save_profile_and_badge(p_profile jsonb, p_badge jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Login required'; end if;
  if nullif(btrim(p_profile->>'public_name'), '') is null then raise exception '氏名を入力してください'; end if;
  update public.cpp_profiles set
    public_name = p_profile->>'public_name', photo_path = p_profile->>'photo_path',
    degree_level = p_profile->>'degree_level', degree_status = p_profile->>'degree_status',
    degree_text = p_profile->>'degree_text', degree_institution = p_profile->>'degree_institution',
    degree_date = nullif(p_profile->>'degree_date', '')::date,
    affiliation = p_profile->>'affiliation', position_title = p_profile->>'position_title', updated_at = now()
  where user_id = v_user;
  if not found then raise exception 'Researcher registration required'; end if;
  insert into public.parari_social_profiles(user_id, display_name, photo_url, affiliation, role_title, topics, intro)
  values(v_user, p_profile->>'public_name', p_badge->>'photo_url', p_profile->>'affiliation', p_profile->>'position_title',
    array(select jsonb_array_elements_text(coalesce(p_badge->'topics', '[]'::jsonb))), p_badge->>'intro')
  on conflict(user_id) do update set display_name = excluded.display_name, photo_url = excluded.photo_url,
    affiliation = excluded.affiliation, role_title = excluded.role_title, topics = excluded.topics, intro = excluded.intro;
end;
$$;
revoke all on function public.cpp_save_profile_and_badge(jsonb,jsonb) from public, anon;
grant execute on function public.cpp_save_profile_and_badge(jsonb,jsonb) to authenticated;
