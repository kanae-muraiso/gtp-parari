alter table public.message_thread_contexts
  add column if not exists user_a_role text null,
  add column if not exists user_b_role text null;

update public.message_thread_contexts mtc
set
  user_a_role = case
    when mt.user_a_id = a.owner_user_id then 'application_owner'
    else 'application_applicant'
  end,
  user_b_role = case
    when mt.user_b_id = a.owner_user_id then 'application_owner'
    else 'application_applicant'
  end
from public.message_threads mt,
     public.application_entries ae,
     public.applications a
where mtc.thread_id = mt.id
  and mtc.context_type = 'application'
  and ae.id = mtc.context_id
  and a.id = ae.application_id;;
