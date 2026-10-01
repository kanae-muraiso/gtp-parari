-- Researcher news is independent of alumni news and PARARI-wide announcements.
create function cpp_private.researcher_news_can_read()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and case
    when exists(select 1 from cpp_private.mode_users where user_id=auth.uid()) then
      exists(select 1 from cpp_private.mode_users where user_id=auth.uid() and mode in ('admin','researcher'))
    else exists(select 1 from public.cpp_profiles where user_id=auth.uid()) and (
      not exists(select 1 from public.cpp_alumni where user_id=auth.uid()) or
      exists(select 1 from cpp_private.alumni_participation where user_id=auth.uid() and choice='researcher')
    )
  end;
$$;
revoke all on function cpp_private.researcher_news_can_read() from public,anon;
grant execute on function cpp_private.researcher_news_can_read() to authenticated;

create table public.cpp_researcher_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  status text not null default 'draft' check (status in ('draft','published')),
  is_important boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint cpp_researcher_announcements_publication check (status <> 'published' or published_at is not null)
);
create index cpp_researcher_announcements_feed_idx on public.cpp_researcher_announcements(status,is_important desc,published_at desc,created_at desc,id desc);
create index cpp_researcher_announcements_creator_idx on public.cpp_researcher_announcements(created_by);
alter table public.cpp_researcher_announcements enable row level security;
revoke all on public.cpp_researcher_announcements from public,anon,authenticated;
grant select on public.cpp_researcher_announcements to authenticated;
create policy cpp_researcher_announcements_read on public.cpp_researcher_announcements for select to authenticated
  using ((select cpp_private.researcher_news_can_read()) and (status='published' or (select cpp_private.alumni_is_admin())));

create function public.cpp_researcher_news(p_manage boolean default false,p_limit integer default 20,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_items jsonb; v_total bigint; v_admin boolean := cpp_private.alumni_is_admin();
begin
  if not cpp_private.researcher_news_can_read() or (p_manage is true and not v_admin) then
    raise exception '研究者向けのお知らせを閲覧する権限がありません。' using errcode='42501';
  end if;
  if p_manage is null or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset < 0 then
    raise exception 'Invalid pagination' using errcode='22023';
  end if;
  select count(*) into v_total from public.cpp_researcher_announcements where p_manage or status='published';
  select coalesce(jsonb_agg(to_jsonb(x) order by x.is_important desc,x.published_at desc nulls last,x.created_at desc,x.id desc),'[]'::jsonb)
    into v_items from (
      select id,title,body,status,is_important,created_at,updated_at,published_at
      from public.cpp_researcher_announcements where p_manage or status='published'
      order by is_important desc,published_at desc nulls last,created_at desc,id desc limit p_limit offset p_offset
    ) x;
  return jsonb_build_object('items',v_items,'total',v_total,'can_manage',v_admin);
end $$;

create function public.cpp_save_researcher_announcement(p_title text,p_body text,p_status text,p_important boolean default false,p_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform cpp_private.require_admin_mode();
  if p_title is null or char_length(btrim(p_title)) not between 1 and 120
    or p_body is null or char_length(btrim(p_body)) not between 1 and 10000
    or p_status is null or p_status not in ('draft','published') or p_important is null then
    raise exception 'タイトル・本文・公開状態を確認してください。' using errcode='22023';
  end if;
  if p_id is null then
    insert into public.cpp_researcher_announcements(title,body,status,is_important,created_by,published_at)
      values(btrim(p_title),btrim(p_body),p_status,p_important,auth.uid(),case when p_status='published' then clock_timestamp() end)
      returning id into v_id;
  else
    update public.cpp_researcher_announcements set title=btrim(p_title),body=btrim(p_body),status=p_status,is_important=p_important,
      updated_at=clock_timestamp(),published_at=case when p_status='published' then coalesce(published_at,clock_timestamp()) else published_at end
      where id=p_id returning id into v_id;
    if v_id is null then raise exception 'お知らせが見つかりません。' using errcode='22023'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.cpp_save_researcher_announcement(text,text,text,boolean,uuid),public.cpp_researcher_news(boolean,integer,integer) from public,anon;
grant execute on function public.cpp_save_researcher_announcement(text,text,text,boolean,uuid),public.cpp_researcher_news(boolean,integer,integer) to authenticated;
notify pgrst,'reload schema';
