-- =====================================================================
-- 20260211_fix_security_advisor_views.sql
-- Fix: SECURITY DEFINER views + excessive grants (Supabase Security Advisor)
-- PostgreSQL 15.x
-- =====================================================================

BEGIN;

-- -------------------------------------------------
-- 0) まず “危険な権限” を全部剥がす（最優先）
-- -------------------------------------------------
REVOKE ALL ON TABLE public.v_artist_view_stats FROM anon, authenticated;
REVOKE ALL ON TABLE public.v_my_sales_summary  FROM anon, authenticated;
REVOKE ALL ON TABLE public.v_pending_payouts   FROM anon, authenticated;
REVOKE ALL ON TABLE public.v_viewer_stats      FROM anon, authenticated;

-- -------------------------------------------------
-- 1) ユーザー向け view は “自分だけ” が返るように定義を置換
--    ※ auth.uid() を view に埋めて二重に安全化
-- -------------------------------------------------

-- 自分の売上サマリ（作家向け）
CREATE OR REPLACE VIEW public.v_my_sales_summary AS
SELECT
  e.user_id,
  COALESCE(sum(s.price), 0)::bigint AS gross_sales_yen,
  COALESCE(sum(
    CASE
      WHEN s.purchased_at IS NOT NULL
       AND s.payout_status <> 'paid'::payout_status
      THEN s.artist_reward_yen ELSE 0
    END
  ), 0)::bigint AS pending_payout_yen,
  COALESCE(sum(
    CASE
      WHEN s.purchased_at IS NOT NULL
       AND s.payout_status = 'paid'::payout_status
      THEN s.artist_reward_yen ELSE 0
    END
  ), 0)::bigint AS paid_out_yen
FROM entries e
LEFT JOIN sales s ON s.entry_id = e.id
WHERE e.user_id = auth.uid()
GROUP BY e.user_id;

-- 自分の閲覧統計（作家向け）
CREATE OR REPLACE VIEW public.v_artist_view_stats AS
SELECT
  e.user_id,
  COALESCE(count(ev.id), 0)::bigint AS total_views,
  COALESCE(count(DISTINCT ev.session_id), 0)::bigint AS unique_views,
  COALESCE(count(DISTINCT ev.entry_id), 0)::bigint AS viewed_works_count,
  max(ev.occurred_at) AS last_viewed_at
FROM entries e
LEFT JOIN entry_view_events ev ON ev.entry_id = e.id
WHERE e.user_id = auth.uid()
  AND e.confirmed = true
GROUP BY e.user_id;

-- 自分が見た統計（閲覧者向け）
CREATE OR REPLACE VIEW public.v_viewer_stats AS
SELECT
  ev.viewer_user_id AS user_id,
  count(*) AS total_views,
  count(DISTINCT ev.entry_id) AS unique_works_viewed,
  max(ev.occurred_at) AS last_viewed_at
FROM entry_view_events ev
WHERE ev.viewer_user_id = auth.uid()
GROUP BY ev.viewer_user_id;

-- -------------------------------------------------
-- 2) SECURITY DEFINER をやめて “呼び出し元権限” にする
--    (Postgres 15 なので security_invoker が使える)
-- -------------------------------------------------
ALTER VIEW public.v_my_sales_summary  SET (security_invoker = true);
ALTER VIEW public.v_artist_view_stats SET (security_invoker = true);
ALTER VIEW public.v_viewer_stats      SET (security_invoker = true);

-- v_pending_payouts は管理専用（service_role で読む）なので
-- security_definer のままでもOK。ただし anon/authenticated に権限を与えないことが条件。

-- -------------------------------------------------
-- 3) 最小権限だけ戻す（authenticated の SELECT のみ）
-- -------------------------------------------------
GRANT SELECT ON TABLE public.v_my_sales_summary  TO authenticated;
GRANT SELECT ON TABLE public.v_artist_view_stats TO authenticated;
GRANT SELECT ON TABLE public.v_viewer_stats      TO authenticated;

-- anon は完全にブロック
REVOKE ALL ON TABLE public.v_my_sales_summary  FROM anon;
REVOKE ALL ON TABLE public.v_artist_view_stats FROM anon;
REVOKE ALL ON TABLE public.v_viewer_stats      FROM anon;

-- 管理専用 view は完全にブロック（重要）
REVOKE ALL ON TABLE public.v_pending_payouts FROM anon, authenticated;

COMMIT;
