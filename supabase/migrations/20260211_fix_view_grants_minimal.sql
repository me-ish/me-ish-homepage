-- =====================================================================
-- 20260211_fix_view_grants_minimal.sql
-- Normalize excessive privileges on views (remove write-level grants)
-- =====================================================================

BEGIN;

-- 1) revoke EVERYTHING from anon/authenticated for these views
REVOKE ALL ON TABLE public.announcements_public   FROM anon, authenticated;
REVOKE ALL ON TABLE public.aura_first20_stats     FROM anon, authenticated;
REVOKE ALL ON TABLE public.entry_comment_counts   FROM anon, authenticated;
REVOKE ALL ON TABLE public.entry_view_stats       FROM anon, authenticated;
REVOKE ALL ON TABLE public.v_admin_entry_workflow FROM anon, authenticated;
REVOKE ALL ON TABLE public.v_cert_links_active    FROM anon, authenticated;
REVOKE ALL ON TABLE public.v_my_external_user_ids FROM anon, authenticated;

-- 2) grant back SELECT only (暫定)
-- Public-ish views: allow anon + authenticated to read
GRANT SELECT ON TABLE public.announcements_public TO anon, authenticated;
GRANT SELECT ON TABLE public.entry_comment_counts TO anon, authenticated;
GRANT SELECT ON TABLE public.entry_view_stats TO anon, authenticated;
GRANT SELECT ON TABLE public.v_cert_links_active TO anon, authenticated;

-- Logged-in only
GRANT SELECT ON TABLE public.v_my_external_user_ids TO authenticated;

-- Admin-only (keep closed)
-- (no grants)

COMMIT;
