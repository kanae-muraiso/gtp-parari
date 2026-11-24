-- 2026-11-24 JST
-- PART: Public work card projection without SSOT raw content.
-- Applied to production Supabase project gqlwepkldjxqvlfxsoel on 2026-11-24.
-- This file records the applied grants and projection. Do not treat as an automatic migration.
-- Existing parari_books public row SELECT is NOT yet revoked.
CREATE OR REPLACE VIEW public.parari_public_work_cards WITH (security_barrier=true) AS
SELECT
  b.id, b.owner, b.title, b.visibility, b.is_public,
  b.created_at, b.updated_at, b.published_at,
  b.stable_slug, b.custom_slug, b.slug, b.entry_mode,
  b.show_in_profile_works, b.profile_works_order,
  b.is_deleted, b.expires_at,
  CASE
    WHEN left(upper(ltrim(b.content)),6)='[BOOK]' OR left(upper(ltrim(b.content)),10)='[BOOKINFO]' THEN 'book'
    WHEN left(upper(ltrim(b.content)),6)='[PAGE]' OR left(upper(ltrim(b.content)),10)='[PAGEINFO]' THEN 'page'
    WHEN left(upper(ltrim(b.content)),5)='[WEB]' OR left(upper(ltrim(b.content)),9)='[WEBINFO]' THEN 'web'
    ELSE 'unknown'
  END AS work_kind,
  COALESCE(
    (regexp_match(b.content, '(?m)^\\s*coverImage:\\s*(https?://[^\\s]+)'))[1],
    (regexp_match(b.content, '(?m)^\\s*mainImage:\\s*(https?://[^\\s]+)'))[1],
    (regexp_match(b.content, '(?m)^\\s*\\[IMAGE\\]\\s*(https?://[^\\s]+)'))[1],
    ''
  ) AS cover_image,
  COALESCE(NULLIF(b.title,''), (regexp_match(b.content,'(?m)^\\s*title:\\s*(.+)
WHERE b.visibility='public'
  AND b.is_deleted IS NOT TRUE
  AND (b.expires_at IS NULL OR b.expires_at > now())
  AND NOT EXISTS (
    SELECT 1 FROM public.commerce_products p
    WHERE p.work_id=b.id AND p.product_type='work' AND p.active=true
  );
REVOKE ALL ON public.parari_public_work_cards FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.parari_public_work_cards TO anon, authenticated;
-- Obsolete raw-content view is no longer publicly callable.
REVOKE SELECT ON public.parari_public_works FROM anon, authenticated;

-- Next, after all public-read consumers move to public cards or admin-only
-- per-work DTO endpoints, replace public_can_read_visible with public-row denial
-- for anon/authenticated. Do not run this RLS step before that consumer audit.
))[1], 'Untitled') AS display_title
FROM public.parari_books b
WHERE b.visibility='public'
  AND b.is_deleted IS NOT TRUE
  AND (b.expires_at IS NULL OR b.expires_at > now())
  AND NOT EXISTS (
    SELECT 1 FROM public.commerce_products p
    WHERE p.work_id=b.id AND p.product_type='work' AND p.active=true
  );
REVOKE ALL ON public.parari_public_work_cards FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.parari_public_work_cards TO anon, authenticated;
-- Obsolete raw-content view is no longer publicly callable.
REVOKE SELECT ON public.parari_public_works FROM anon, authenticated;

-- Next, after all public-read consumers move to public cards or admin-only
-- per-work DTO endpoints, replace public_can_read_visible with public-row denial
-- for anon/authenticated. Do not run this RLS step before that consumer audit.

-- Once the application stops reading public work rows directly, the following
-- change can be performed in one DB transaction to block raw SSOT.
-- See cutover record; DO NOT run early:
-- DROP POLICY IF EXISTS public_can_read_visible ON public.parari_books;
-- Other author/collaborator/entitlement SELECT policies must remain unchanged.
