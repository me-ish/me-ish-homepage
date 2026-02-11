-- =====================================================================
-- 20260211_fix_security_advisor_remaining_views.sql
-- Fix remaining Security Advisor findings:
--  - remove excessive grants
--  - set security_invoker where appropriate
--  - grant SELECT only to the right roles
-- =====================================================================

BEGIN;

-- -------------------------------------------------
-- 0) まず危険な権限を全部剥がす（anon/authenticated）
-- -------------------------------------------------
REVOKE ALL ON TABLE public.announcements_public   FROM anon, authenticated;
REVOKE ALL ON TABLE public.entry_comment_counts   FROM anon, authenticated;
REVOKE ALL ON TABLE public.entry_view_stats       FROM anon, authenticated;
REVOKE ALL ON TABLE public.v_my_external_user_ids FROM anon, authenticated;

REVOKE ALL ON TABLE public.v_admin_entry_workflow FROM anon, authenticated;
REVOKE ALL ON TABLE public.aura_first20_stats     FROM anon, authenticated;
REVOKE ALL ON TABLE public.v_cert_links_active    FROM anon, authenticated;

-- -------------------------------------------------
-- 1) 公開/ログイン向け view は invoker 化（definerをやめる）
-- -------------------------------------------------
ALTER VIEW public.announcements_public   SET (security_invoker = true);
ALTER VIEW public.entry_comment_counts   SET (security_invoker = true);
ALTER VIEW public.entry_view_stats       SET (security_invoker = true);
ALTER VIEW public.v_my_external_user_ids SET (security_invoker = true);

-- 管理専用も invoker に寄せる（任意だが推奨：将来の事故を減らす）
ALTER VIEW public.v_admin_entry_workflow SET (security_invoker = true);
ALTER VIEW public.aura_first20_stats     SET (security_invoker = true);

-- v_cert_links_active も invoker に寄せてOK（ただし公開しない）
ALTER VIEW public.v_cert_links_active    SET (security_invoker = true);

-- -------------------------------------------------
-- 2) 最小権限だけ戻す
-- -------------------------------------------------

-- public pages: anon + authenticated can read
GRANT SELECT ON TABLE public.announcements_public TO anon, authenticated;
GRANT SELECT ON TABLE public.entry_comment_counts TO anon, authenticated;
GRANT SELECT ON TABLE public.entry_view_stats     TO anon, authenticated;

-- logged-in only
GRANT SELECT ON TABLE public.v_my_external_user_ids TO authenticated;

-- admin-only: keep closed (no grants)
-- public.v_admin_entry_workflow
-- public.aura_first20_stats

-- sensitive: keep closed (no grants)
-- public.v_cert_links_active

COMMIT;
