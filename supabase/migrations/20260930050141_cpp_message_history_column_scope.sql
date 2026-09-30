create or replace function public.cpp_message_history(p_thread uuid,p_before bigint default null) returns table(id bigint,sender_id uuid,body text,exception_delivery boolean,created_at timestamptz) language plpgsql stable security definer set search_path='' as $$
declare me uuid:=cpp_private.require_message_user();
begin
 if not exists(select 1 from cpp_private.message_threads t where t.id=p_thread and me in(t.user_a,t.user_b)) then raise exception 'この会話は閲覧できません' using errcode='42501'; end if;
 return query select m.id,m.sender_id,m.body,m.exception_delivery,m.created_at from cpp_private.messages m where m.thread_id=p_thread and (p_before is null or m.id<p_before) order by m.id desc limit 100;
end $$;
