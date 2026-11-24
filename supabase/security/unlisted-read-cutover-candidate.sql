-- TEST CANDIDATE ONLY. DO NOT APPLY TO PRODUCTION without full dependency review.
-- Tighten anonymous/public row access while preserving paid-source restrictions.
BEGIN;
DROP POLICY IF EXISTS public_can_read_visible ON public.parari_books;
CREATE POLICY public_can_read_visible ON public.parari_books
 FOR SELECT TO anon, authenticated
 USING (visibility = 'public' AND is_deleted IS NOT TRUE
        AND (expires_at IS NULL OR expires_at > now()));

-- Keep paid_source_no_anonymous and paid_source_author_only.
-- They are RESTRICTIVE policies that protect [PAYWALL] source content.

-- Run the view under the caller's privileges so table RLS is applied.
ALTER VIEW public.parari_public_works SET (security_invoker = true);
COMMIT;
