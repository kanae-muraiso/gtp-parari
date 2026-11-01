-- Require reading-state updates to keep a work that the actor may save.
drop policy if exists "reading_update_own" on public.parari_reading_states;
create policy "reading_update_own" on public.parari_reading_states
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and exists (
 select 1 from public.parari_books b
 where b.id = work_id and b.is_deleted is distinct from true
 and (b.owner = (select auth.uid()) or b.visibility = 'public')
));
