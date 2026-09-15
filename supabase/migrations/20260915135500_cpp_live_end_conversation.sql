create or replace function public.cpp_live_end_conversation(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_me uuid := auth.uid();
  v_context_id uuid;
begin
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  select c.id into v_context_id
  from public.message_threads mt
  join public.message_thread_contexts c on c.thread_id = mt.id
  join public.memberships m on m.id = c.context_id
  join public.membership_members mm
    on mm.membership_id = m.id
   and mm.user_id = v_me
   and mm.status = 'active'
  where mt.id = p_thread_id
    and (mt.user_a_id = v_me or mt.user_b_id = v_me)
    and c.context_type = 'membership'
    and c.relationship_type = 'matching_live_direct'
    and c.status = 'active'
    and m.name = 'CPP'
    and m.membership_mode = 'matching'
  limit 1;

  if v_context_id is null then
    raise exception 'Active CPP LIVE conversation not found';
  end if;

  update public.message_thread_contexts as c
  set status = 'ended',
      ended_at = now()
  where c.id = v_context_id;
end;
$function$;

grant execute on function public.cpp_live_end_conversation(uuid) to authenticated;
