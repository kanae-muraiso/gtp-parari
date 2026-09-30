-- Private account-based messaging, independent of LIVE and operator modes.
create schema if not exists cpp_private;
create table cpp_private.message_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 accepting boolean not null default true
);
create table cpp_private.message_blocks (
 owner_id uuid references auth.users(id) on delete cascade,
 blocked_id uuid references auth.users(id) on delete cascade,
 primary key(owner_id,blocked_id), check(owner_id<>blocked_id)
);
create table cpp_private.message_threads (
 id uuid primary key default gen_random_uuid(),
 user_a uuid not null references auth.users(id) on delete cascade,
 user_b uuid not null references auth.users(id) on delete cascade,
 started_by uuid not null references auth.users(id),
 pending_exception boolean not null default false,
 read_a bigint not null default 0, read_b bigint not null default 0,
 updated_at timestamptz not null default now(),
 unique(user_a,user_b), check(user_a<user_b), check(started_by in(user_a,user_b))
);
create table cpp_private.messages (
 id bigint generated always as identity primary key,
 thread_id uuid not null references cpp_private.message_threads(id) on delete cascade,
 sender_id uuid not null references auth.users(id),
 body text not null check(length(trim(body)) between 1 and 4000),
 exception_delivery boolean not null default false,
 created_at timestamptz not null default clock_timestamp()
);
create index message_threads_a_updated on cpp_private.message_threads(user_a,updated_at desc);
create index message_threads_b_updated on cpp_private.message_threads(user_b,updated_at desc);
create index messages_thread_id on cpp_private.messages(thread_id,id desc);
alter table cpp_private.message_preferences enable row level security;
alter table cpp_private.message_blocks enable row level security;
alter table cpp_private.message_threads enable row level security;
alter table cpp_private.messages enable row level security;
revoke all on schema cpp_private from public,anon,authenticated;
revoke all on cpp_private.message_preferences,cpp_private.message_blocks,cpp_private.message_threads,cpp_private.messages from public,anon,authenticated;

create function cpp_private.message_pair_lock(p_other uuid) returns void language plpgsql set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(least(auth.uid(),p_other)::text||':'||greatest(auth.uid(),p_other)::text,0));
end $$;
create function cpp_private.require_message_user() returns uuid language plpgsql stable set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'ログインしてください' using errcode='42501'; end if;
 return auth.uid();
end $$;
create function cpp_private.message_eligible(p_user uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.cpp_alumni where user_id=p_user);
$$;
create function public.cpp_message_settings() returns table(accepting boolean,eligible boolean) language plpgsql stable security definer set search_path='' as $$
declare me uuid:=cpp_private.require_message_user();
begin
 return query select coalesce((select p.accepting from cpp_private.message_preferences p where p.user_id=me),true),cpp_private.message_eligible(me);
end $$;
create function public.cpp_message_set_accepting(p_accepting boolean) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=cpp_private.require_message_user();
begin
 if p_accepting is null then raise exception 'Invalid setting'; end if;
 insert into cpp_private.message_preferences(user_id,accepting) values(me,p_accepting) on conflict(user_id) do update set accepting=excluded.accepting;
end $$;
create function public.cpp_message_targets(p_user_ids uuid[]) returns table(user_id uuid,display_name text,accepting boolean,blocked_by_me boolean,existing boolean) language plpgsql stable security definer set search_path='' as $$
declare me uuid:=cpp_private.require_message_user();
begin
 if not cpp_private.message_eligible(me) then return; end if;
 return query select a.user_id,coalesce(nullif(sp.display_name,''),nullif(p.display_name,''),p.username,'CPP参加者')::text,
 coalesce(pref.accepting,true),exists(select 1 from cpp_private.message_blocks b where b.owner_id=me and b.blocked_id=a.user_id),
 exists(select 1 from cpp_private.message_threads t where t.user_a=least(me,a.user_id) and t.user_b=greatest(me,a.user_id))
 from public.cpp_alumni a left join public.profiles p on p.user_id=a.user_id
 left join public.parari_social_profiles sp on sp.user_id=a.user_id
 left join cpp_private.message_preferences pref on pref.user_id=a.user_id
 where a.user_id=any(p_user_ids) and cardinality(p_user_ids)<=200;
end $$;
create function public.cpp_message_send(p_recipient uuid,p_body text,p_override boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=cpp_private.require_message_user(); t cpp_private.message_threads%rowtype; accepts boolean; warned boolean:=false;
begin
 if p_recipient is null or p_recipient=me then raise exception '相手を選択してください'; end if;
 if length(trim(coalesce(p_body,''))) not between 1 and 4000 then raise exception '本文は1〜4000文字で入力してください'; end if;
 perform cpp_private.message_pair_lock(p_recipient);
 if not cpp_private.message_eligible(me) or not cpp_private.message_eligible(p_recipient) then raise exception '現在は同窓会登録者同士で利用できます' using errcode='42501'; end if;
 if exists(select 1 from cpp_private.message_blocks b where (b.owner_id=me and b.blocked_id=p_recipient) or (b.owner_id=p_recipient and b.blocked_id=me)) then raise exception 'この相手には送信できません' using errcode='42501'; end if;
 select * into t from cpp_private.message_threads where user_a=least(me,p_recipient) and user_b=greatest(me,p_recipient) for update;
 if t.id is null then
  select coalesce((select accepting from cpp_private.message_preferences where user_id=p_recipient),true) into accepts;
  if not accepts and not coalesce(p_override,false) then raise exception '受付停止中です。最初の1通を送るには確認してください' using errcode='P0002'; end if;
  warned:=not accepts;
  insert into cpp_private.message_threads(user_a,user_b,started_by,pending_exception) values(least(me,p_recipient),greatest(me,p_recipient),me,warned) returning * into t;
 elsif t.pending_exception then
  if t.started_by=me then raise exception '返信があるまで追加送信できません'; end if;
  update cpp_private.message_threads set pending_exception=false where id=t.id;
 end if;
 insert into cpp_private.messages(thread_id,sender_id,body,exception_delivery) values(t.id,me,trim(p_body),warned);
 update cpp_private.message_threads set updated_at=clock_timestamp() where id=t.id;
 return t.id;
end $$;
create function public.cpp_message_inbox() returns table(thread_id uuid,other_id uuid,display_name text,last_body text,updated_at timestamptz,unread bigint,pending_exception boolean,waiting_for_reply boolean,blocked_by_me boolean) language plpgsql stable security definer set search_path='' as $$
declare me uuid:=cpp_private.require_message_user();
begin
 return query select t.id,o.user_id,coalesce(nullif(sp.display_name,''),nullif(p.display_name,''),p.username,'CPP参加者')::text,
 (select m.body from cpp_private.messages m where m.thread_id=t.id order by m.id desc limit 1),t.updated_at,
 (select count(*) from cpp_private.messages m where m.thread_id=t.id and m.sender_id<>me and m.id>case when t.user_a=me then t.read_a else t.read_b end),
 t.pending_exception,t.pending_exception and t.started_by=me,
 exists(select 1 from cpp_private.message_blocks b where b.owner_id=me and b.blocked_id=o.user_id)
 from cpp_private.message_threads t cross join lateral(select case when t.user_a=me then t.user_b else t.user_a end user_id) o
 left join public.profiles p on p.user_id=o.user_id left join public.parari_social_profiles sp on sp.user_id=o.user_id
 where me in(t.user_a,t.user_b) order by t.updated_at desc;
end $$;
create function public.cpp_message_unread() returns bigint language plpgsql stable security definer set search_path='' as $$
declare me uuid:=cpp_private.require_message_user(); result bigint;
begin
 select count(*) into result from cpp_private.messages m join cpp_private.message_threads t on t.id=m.thread_id
 where me in(t.user_a,t.user_b) and m.sender_id<>me and m.id>case when t.user_a=me then t.read_a else t.read_b end;
 return result;
end $$;
create function public.cpp_message_history(p_thread uuid,p_before bigint default null) returns table(id bigint,sender_id uuid,body text,exception_delivery boolean,created_at timestamptz) language plpgsql stable security definer set search_path='' as $$
declare me uuid:=cpp_private.require_message_user();
begin
 if not exists(select 1 from cpp_private.message_threads where id=p_thread and me in(user_a,user_b)) then raise exception 'この会話は閲覧できません' using errcode='42501'; end if;
 return query select m.id,m.sender_id,m.body,m.exception_delivery,m.created_at from cpp_private.messages m where m.thread_id=p_thread and (p_before is null or m.id<p_before) order by m.id desc limit 100;
end $$;
create function public.cpp_message_mark_read(p_thread uuid,p_last_id bigint) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=cpp_private.require_message_user();
begin
 if not exists(select 1 from cpp_private.messages where thread_id=p_thread and id=p_last_id) then return; end if;
 update cpp_private.message_threads set read_a=case when user_a=me then greatest(read_a,p_last_id) else read_a end,read_b=case when user_b=me then greatest(read_b,p_last_id) else read_b end where id=p_thread and me in(user_a,user_b);
 if not found then raise exception 'この会話は閲覧できません' using errcode='42501'; end if;
end $$;
create function public.cpp_message_block(p_user uuid,p_block boolean) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=cpp_private.require_message_user();
begin
 if p_user is null or p_user=me or p_block is null then raise exception 'Invalid block'; end if;
 perform cpp_private.message_pair_lock(p_user);
 if p_block then insert into cpp_private.message_blocks(owner_id,blocked_id) values(me,p_user) on conflict do nothing;
 else delete from cpp_private.message_blocks where owner_id=me and blocked_id=p_user; end if;
end $$;
create function public.cpp_message_blocks() returns table(user_id uuid,display_name text) language plpgsql stable security definer set search_path='' as $$
declare me uuid:=cpp_private.require_message_user();
begin
 return query select b.blocked_id,coalesce(nullif(sp.display_name,''),nullif(p.display_name,''),p.username,'CPP参加者')::text from cpp_private.message_blocks b left join public.profiles p on p.user_id=b.blocked_id left join public.parari_social_profiles sp on sp.user_id=b.blocked_id where b.owner_id=me;
end $$;
revoke all on all functions in schema cpp_private from public,anon,authenticated;
revoke all on function public.cpp_message_settings(),public.cpp_message_set_accepting(boolean),public.cpp_message_targets(uuid[]),public.cpp_message_send(uuid,text,boolean),public.cpp_message_inbox(),public.cpp_message_unread(),public.cpp_message_history(uuid,bigint),public.cpp_message_mark_read(uuid,bigint),public.cpp_message_block(uuid,boolean),public.cpp_message_blocks() from public,anon;
grant execute on function public.cpp_message_settings(),public.cpp_message_set_accepting(boolean),public.cpp_message_targets(uuid[]),public.cpp_message_send(uuid,text,boolean),public.cpp_message_inbox(),public.cpp_message_unread(),public.cpp_message_history(uuid,bigint),public.cpp_message_mark_read(uuid,bigint),public.cpp_message_block(uuid,boolean),public.cpp_message_blocks() to authenticated;
