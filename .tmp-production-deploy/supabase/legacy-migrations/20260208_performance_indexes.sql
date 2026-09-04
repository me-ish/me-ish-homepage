-- 20260208_performance_indexes.sql
-- パフォーマンス向上のためのインデックス追加
-- すべて IF NOT EXISTS で冪等

-- ============================================================
-- entries テーブル
-- ============================================================

-- ギャラリー公開ページ（/float/2d, /white/2d）: gallery_type + confirmed + display_ready + confirmed_at
CREATE INDEX IF NOT EXISTS idx_entries_gallery_display
  ON public.entries(gallery_type, confirmed_at DESC)
  WHERE confirmed = true AND display_ready = true;

-- マイページ・ポートフォリオ: user_id 別の作品一覧
CREATE INDEX IF NOT EXISTS idx_entries_user_confirmed
  ON public.entries(user_id, created_at DESC)
  WHERE confirmed = true;

-- email ベースのエントリ検索（user_id 未連携ユーザー向けフォールバック）
CREATE INDEX IF NOT EXISTS idx_entries_email
  ON public.entries(email)
  WHERE email IS NOT NULL;

-- 管理画面: 未レビュー作品キュー
CREATE INDEX IF NOT EXISTS idx_entries_admin_unreviewed
  ON public.entries(created_at DESC)
  WHERE confirmed IS NULL;

-- ポートフォリオ公開作品: user_id + display_ready + portfolio_hidden
CREATE INDEX IF NOT EXISTS idx_entries_portfolio_public
  ON public.entries(user_id, created_at DESC)
  WHERE confirmed = true AND display_ready = true AND portfolio_hidden = false;

-- ============================================================
-- sales テーブル
-- ============================================================

-- Stripe session ID によるレシート・冪等性チェック（UNIQUE）
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_stripe_session
  ON public.sales(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

-- 月次精算バッチ: entry_id + payout_status
CREATE INDEX IF NOT EXISTS idx_sales_entry_payout
  ON public.sales(entry_id, purchased_at)
  WHERE payout_status = 'pending' AND purchased_at IS NOT NULL;

-- ============================================================
-- aura_requests テーブル
-- ============================================================

-- 公開 slug による検索（/aura/u/[slug]）（UNIQUE）
CREATE UNIQUE INDEX IF NOT EXISTS idx_aura_requests_public_slug
  ON public.aura_requests(public_slug)
  WHERE public_slug IS NOT NULL;

-- 公開 ID による検索（/aura/p/[public_id]）（UNIQUE）
CREATE UNIQUE INDEX IF NOT EXISTS idx_aura_requests_public_id
  ON public.aura_requests(public_id)
  WHERE public_id IS NOT NULL;

-- レガシー slug 検索（旧 URL 互換）
CREATE INDEX IF NOT EXISTS idx_aura_requests_slug
  ON public.aura_requests(slug)
  WHERE slug IS NOT NULL;

-- ============================================================
-- entry_view_stats はビューのためインデックス不可（元テーブル側で対応済み）
-- ============================================================

-- ============================================================
-- entry_view_events テーブル（viewer_user_id 検索用）
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_entry_view_events_viewer
  ON public.entry_view_events(viewer_user_id, entry_id)
  WHERE viewer_user_id IS NOT NULL;
