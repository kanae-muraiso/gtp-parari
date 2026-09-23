begin;

-- Supabase may grant EXECUTE to anon explicitly via default privileges.
-- Keep the quota helper callable only by signed-in users.
revoke all on function public.parari_can_upload_image(text, jsonb) from public;
revoke all on function public.parari_can_upload_image(text, jsonb) from anon;
grant execute on function public.parari_can_upload_image(text, jsonb) to authenticated;

commit;
