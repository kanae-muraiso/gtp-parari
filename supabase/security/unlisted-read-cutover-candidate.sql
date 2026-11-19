-- TEST CANDIDATE ONLY. DO NOT APPLY TO PRODUCTION without full dependency review.
-- The RLS policies here only address unauthorized direct SELECT of free works.
-- Paid work publication is separately kept private by the commerce triggers.
BEGIN;
DROP POLICY IF EXISTS public_can_read_visible ON public.parari_books;
DROP POLICY IF EXISTS paid_source_no_anonymous ON public.parari_books;
DROP POLICY IF EXISTS paid_source_author_only ON public.parari_books;
CREATE POLICY public_can_read_visible ON public.parari_books
 FOR SELECT TO anon, authenticated
 USING (visibility = 'public' AND is_deleted IS NOT TRUE
        AND (expires_at IS NULL OR expires_at > now()));
ALTER VIEW public.parari_public_works SET (security_invoker = true);
COMMIT;
