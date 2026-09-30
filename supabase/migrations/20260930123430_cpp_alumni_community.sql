-- Alumni community data is separate from researcher profiles and PARARI news.
create function cpp_private.alumni_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from cpp_private.mode_users where user_id = auth.uid() and mode = 'admin');
$$;
create function cpp_private.alumni_can_read()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and
    (private.is_cpp_alumni_member(auth.uid()) or cpp_private.alumni_is_admin());
$$;
revoke all on function cpp_private.alumni_is_admin(), cpp_private.alumni_can_read() from public, anon;
grant execute on function cpp_private.alumni_is_admin(), cpp_private.alumni_can_read() to authenticated;

create table public.cpp_alumni_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.cpp_alumni(user_id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 200),
  work_url text check (work_url is null or (char_length(work_url) <= 2048 and work_url ~ '^https://(www\.)?parari\.app/[^[:space:]\\]+$')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  hidden_at timestamptz,
  hidden_by uuid references auth.users(id) on delete set null
);
create index cpp_alumni_updates_feed_idx on public.cpp_alumni_updates(created_at desc, id desc);
create index cpp_alumni_updates_author_idx on public.cpp_alumni_updates(user_id, created_at desc, id desc);
create index cpp_alumni_updates_hidden_by_idx on public.cpp_alumni_updates(hidden_by) where hidden_by is not null;
alter table public.cpp_alumni_updates enable row level security;
revoke all on public.cpp_alumni_updates from anon, authenticated;
grant select on public.cpp_alumni_updates to authenticated;
create policy cpp_alumni_updates_read on public.cpp_alumni_updates for select to authenticated
  using ((select cpp_private.alumni_can_read()) and (hidden_at is null or (select cpp_private.alumni_is_admin())));

create table public.cpp_alumni_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  status text not null default 'draft' check (status in ('draft','published')),
  is_important boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint cpp_alumni_announcements_publication check (status <> 'published' or published_at is not null)
);
create index cpp_alumni_announcements_feed_idx on public.cpp_alumni_announcements(status, is_important desc, published_at desc, id desc);
create index cpp_alumni_announcements_creator_idx on public.cpp_alumni_announcements(created_by);
alter table public.cpp_alumni_announcements enable row level security;
revoke all on public.cpp_alumni_announcements from anon, authenticated;
grant select on public.cpp_alumni_announcements to authenticated;
create policy cpp_alumni_announcements_read on public.cpp_alumni_announcements for select to authenticated
  using ((select cpp_private.alumni_can_read()) and (status = 'published' or (select cpp_private.alumni_is_admin())));

create function public.cpp_alumni_community_context()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('user_id',auth.uid(),'is_alumni',private.is_cpp_alumni_member(auth.uid()),'is_admin',cpp_private.alumni_is_admin());
$$;

-- Return only the shared namecard and alumni registration, never CPP researcher data.
create function public.cpp_alumni_community_members(p_user_id uuid default null, p_limit integer default 30, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_members jsonb; v_total bigint;
begin
  if not cpp_private.alumni_can_read() then raise exception '同窓会への登録が必要です。' using errcode = '42501'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or p_offset is null or p_offset < 0 then raise exception 'Invalid pagination' using errcode = '22023'; end if;
  select count(*) into v_total from public.cpp_alumni a where p_user_id is null or a.user_id = p_user_id;
  select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at desc,m.user_id desc),'[]'::jsonb) into v_members from (
    select a.user_id,a.created_at,a.cpp_memory,
      coalesce(nullif(s.display_name,''),nullif(p.display_name,''),nullif(p.username,''),'名前未設定') as display_name,
      s.photo_url,s.affiliation,s.role_title,s.topics,s.intro,
      coalesce((select jsonb_agg(jsonb_build_object('year',h.participation_year,'location',h.participation_location) order by h.sort_order,h.id)
        from public.cpp_alumni_participations h where h.user_id=a.user_id),
        case when a.participation_year is not null then jsonb_build_array(jsonb_build_object('year',a.participation_year,'location',a.participation_location)) else '[]'::jsonb end) as participations
    from public.cpp_alumni a left join public.parari_social_profiles s on s.user_id=a.user_id
    left join public.profiles p on p.user_id=a.user_id
    where p_user_id is null or a.user_id=p_user_id
    order by a.created_at desc,a.user_id desc limit p_limit offset p_offset
  ) m;
  return jsonb_build_object('members',v_members,'total',v_total);
end $$;

create function public.cpp_alumni_feed(p_user_id uuid default null, p_limit integer default 20, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_posts jsonb; v_total bigint; v_admin boolean := cpp_private.alumni_is_admin();
begin
  if not cpp_private.alumni_can_read() then raise exception '同窓会への登録が必要です。' using errcode = '42501'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or p_offset is null or p_offset < 0 then raise exception 'Invalid pagination' using errcode = '22023'; end if;
  select count(*) into v_total from public.cpp_alumni_updates u
    where (p_user_id is null or u.user_id=p_user_id) and (u.hidden_at is null or v_admin);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]'::jsonb) into v_posts from (
    select u.id,u.user_id,u.body,u.work_url,u.created_at,u.updated_at,u.hidden_at,
      coalesce(nullif(s.display_name,''),nullif(p.display_name,''),nullif(p.username,''),'名前未設定') as display_name,s.photo_url
    from public.cpp_alumni_updates u left join public.parari_social_profiles s on s.user_id=u.user_id
    left join public.profiles p on p.user_id=u.user_id
    where (p_user_id is null or u.user_id=p_user_id) and (u.hidden_at is null or v_admin)
    order by u.created_at desc,u.id desc limit p_limit offset p_offset
  ) x;
  return jsonb_build_object('posts',v_posts,'total',v_total);
end $$;

-- All writes go through guarded RPCs. Clients cannot forge authors or moderation metadata.
create function public.cpp_alumni_save_update(p_body text, p_work_url text default null, p_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_body text := btrim(p_body); v_url text := nullif(btrim(p_work_url),'');
begin
  if not private.is_cpp_alumni_member(auth.uid()) then raise exception '同窓会への登録が必要です。' using errcode = '42501'; end if;
  if v_body is null or char_length(v_body) not between 1 and 200 then raise exception '近況は1〜200文字で入力してください。' using errcode = '22023'; end if;
  if v_url is not null and (char_length(v_url)>2048 or v_url !~ '^https://(www\.)?parari\.app/[^[:space:]\\]+$') then
    raise exception 'PARARIの作品URL（https://www.parari.app/…）を入力してください。' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.cpp_alumni_updates(user_id,body,work_url) values(auth.uid(),v_body,v_url) returning id into v_id;
  else
    update public.cpp_alumni_updates set body=v_body,work_url=v_url,updated_at=clock_timestamp()
      where id=p_id and user_id=auth.uid() returning id into v_id;
    if v_id is null then raise exception '自分の投稿だけを編集できます。' using errcode = '42501'; end if;
  end if;
  return v_id;
end $$;
create function public.cpp_alumni_delete_update(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_cpp_alumni_member(auth.uid()) then raise exception '同窓会への登録が必要です。' using errcode = '42501'; end if;
  delete from public.cpp_alumni_updates where id=p_id and user_id=auth.uid();
  if not found then raise exception '自分の投稿だけを削除できます。' using errcode = '42501'; end if;
end $$;
create function public.cpp_alumni_moderate_update(p_id uuid,p_hidden boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform cpp_private.require_admin_mode();
  if p_hidden is null then raise exception 'Invalid visibility' using errcode='22023'; end if;
  update public.cpp_alumni_updates set hidden_at=case when p_hidden then clock_timestamp() end,
    hidden_by=case when p_hidden then auth.uid() end where id=p_id;
  if not found then raise exception '投稿が見つかりません。' using errcode='22023'; end if;
end $$;

create function public.cpp_alumni_news(p_manage boolean default false,p_limit integer default 20,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_items jsonb; v_total bigint;
begin
  if p_manage is true then perform cpp_private.require_admin_mode();
  elsif not cpp_private.alumni_can_read() then raise exception '同窓会への登録が必要です。' using errcode='42501'; end if;
  if p_manage is null or p_limit is null or p_limit < 1 or p_limit > 100 or p_offset is null or p_offset < 0 then raise exception 'Invalid pagination' using errcode='22023'; end if;
  select count(*) into v_total from public.cpp_alumni_announcements where p_manage or status='published';
  select coalesce(jsonb_agg(to_jsonb(x) order by x.is_important desc,x.published_at desc nulls last,x.created_at desc,x.id desc),'[]'::jsonb) into v_items from (
    select id,title,body,status,is_important,created_at,updated_at,published_at from public.cpp_alumni_announcements
    where p_manage or status='published'
    order by is_important desc,published_at desc nulls last,created_at desc,id desc limit p_limit offset p_offset
  ) x;
  return jsonb_build_object('items',v_items,'total',v_total);
end $$;
create function public.cpp_alumni_save_announcement(p_title text,p_body text,p_status text,p_important boolean default false,p_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform cpp_private.require_admin_mode();
  if p_title is null or char_length(btrim(p_title)) not between 1 and 120 or p_body is null or char_length(btrim(p_body)) not between 1 and 10000
    or p_status is null or p_status not in ('draft','published') or p_important is null then raise exception 'タイトル・本文・公開状態を確認してください。' using errcode='22023'; end if;
  if p_id is null then
    insert into public.cpp_alumni_announcements(title,body,status,is_important,created_by,published_at)
      values(btrim(p_title),btrim(p_body),p_status,p_important,auth.uid(),case when p_status='published' then clock_timestamp() end) returning id into v_id;
  else
    update public.cpp_alumni_announcements set title=btrim(p_title),body=btrim(p_body),status=p_status,is_important=p_important,
      updated_at=clock_timestamp(),published_at=case when p_status='published' then coalesce(published_at,clock_timestamp()) else published_at end
      where id=p_id returning id into v_id;
    if v_id is null then raise exception 'お知らせが見つかりません。' using errcode='22023'; end if;
  end if;
  return v_id;
end $$;

revoke all on function public.cpp_alumni_community_context(),public.cpp_alumni_community_members(uuid,integer,integer),public.cpp_alumni_feed(uuid,integer,integer),
  public.cpp_alumni_save_update(text,text,uuid),public.cpp_alumni_delete_update(uuid),public.cpp_alumni_moderate_update(uuid,boolean),
  public.cpp_alumni_news(boolean,integer,integer),public.cpp_alumni_save_announcement(text,text,text,boolean,uuid) from public,anon;
grant execute on function public.cpp_alumni_community_context(),public.cpp_alumni_community_members(uuid,integer,integer),public.cpp_alumni_feed(uuid,integer,integer),
  public.cpp_alumni_save_update(text,text,uuid),public.cpp_alumni_delete_update(uuid),public.cpp_alumni_moderate_update(uuid,boolean),
  public.cpp_alumni_news(boolean,integer,integer),public.cpp_alumni_save_announcement(text,text,text,boolean,uuid) to authenticated;
