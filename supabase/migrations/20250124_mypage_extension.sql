-- ========================================
-- Migration: mypage_extension
-- マイページ拡張：いいね履歴、ポートフォリオ、閲覧計測
-- Created: 2025-01-24
-- ========================================

-- ============================================================
-- 1. portfolio_profiles テーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS public.portfolio_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 公開URL用のスラッグ（ユニーク、NULL許可）
  public_slug text UNIQUE,

  -- 公開状態
  is_public boolean NOT NULL DEFAULT false,

  -- モード: 'template' = 無料テンプレ, 'aura' = AURA連携
  mode text NOT NULL DEFAULT 'template' CHECK (mode IN ('template', 'aura')),

  -- AURAモード時の参照先
  aura_request_id uuid REFERENCES public.aura_requests(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- 1ユーザー1レコード
  CONSTRAINT portfolio_profiles_user_unique UNIQUE (user_id),

  -- 公開時はslug必須
  CONSTRAINT portfolio_profiles_public_requires_slug
    CHECK (NOT is_public OR public_slug IS NOT NULL)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_portfolio_profiles_slug
  ON public.portfolio_profiles(public_slug) WHERE public_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_portfolio_profiles_user
  ON public.portfolio_profiles(user_id);

-- updated_atトリガー（既存関数を再利用）
DROP TRIGGER IF EXISTS trg_portfolio_profiles_updated_at ON public.portfolio_profiles;
CREATE TRIGGER trg_portfolio_profiles_updated_at
  BEFORE UPDATE ON public.portfolio_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.portfolio_profiles ENABLE ROW LEVEL SECURITY;

-- 読み取り: 公開中は誰でも / 非公開は本人のみ
CREATE POLICY "portfolio_profiles_select" ON public.portfolio_profiles
  FOR SELECT USING (
    is_public = true OR auth.uid() = user_id
  );

-- 挿入: 本人のみ
CREATE POLICY "portfolio_profiles_insert" ON public.portfolio_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 更新: 本人のみ
CREATE POLICY "portfolio_profiles_update" ON public.portfolio_profiles
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 削除: 本人のみ
CREATE POLICY "portfolio_profiles_delete" ON public.portfolio_profiles
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.portfolio_profiles IS 'ユーザーの公開ポートフォリオ設定';

-- ============================================================
-- 2. likes テーブル（いいね履歴）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id bigint NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- 重複いいね防止
  CONSTRAINT likes_user_entry_unique UNIQUE (user_id, entry_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_likes_user ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_entry ON public.likes(entry_id);
CREATE INDEX IF NOT EXISTS idx_likes_created ON public.likes(created_at DESC);

-- RLS
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- 読み取り: 本人のいいねのみ
CREATE POLICY "likes_select_own" ON public.likes
  FOR SELECT USING (auth.uid() = user_id);

-- 挿入: 認証ユーザーが自分のいいねを追加
CREATE POLICY "likes_insert" ON public.likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 削除: 本人のいいねのみ
CREATE POLICY "likes_delete" ON public.likes
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.likes IS 'ユーザーのいいね履歴（マイページ用）';

-- ============================================================
-- 3. entry_view_events テーブル（閲覧計測）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.entry_view_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id bigint NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  viewer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- 重複抑止用ユニークインデックス（同一セッション・同一entry・同一時間帯）
-- COALESCEでNULL対応、date_truncで1時間単位に丸める
CREATE UNIQUE INDEX IF NOT EXISTS idx_entry_view_events_dedup
  ON public.entry_view_events (
    entry_id,
    COALESCE(session_id, ''),
    date_trunc('hour', occurred_at)
  );

-- インデックス（集計用）
CREATE INDEX IF NOT EXISTS idx_entry_view_events_entry
  ON public.entry_view_events(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_view_events_occurred
  ON public.entry_view_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_view_events_entry_occurred
  ON public.entry_view_events(entry_id, occurred_at DESC);

-- RLS
ALTER TABLE public.entry_view_events ENABLE ROW LEVEL SECURITY;

-- 読み取り: 作品オーナーのみ自分の作品の統計を見れる
CREATE POLICY "entry_view_events_select_owner" ON public.entry_view_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.entries e
      WHERE e.id = entry_id AND e.user_id = auth.uid()
    )
  );

-- 挿入: クライアント直接禁止（service_roleのみ）
CREATE POLICY "entry_view_events_insert_deny" ON public.entry_view_events
  FOR INSERT WITH CHECK (false);

COMMENT ON TABLE public.entry_view_events IS '作品詳細ページの閲覧イベント（MVP）';

-- ============================================================
-- 4. 閲覧数集計ビュー
-- ============================================================
CREATE OR REPLACE VIEW public.entry_view_stats AS
SELECT
  entry_id,
  COUNT(*) AS view_count,
  COUNT(DISTINCT session_id) AS unique_views,
  MAX(occurred_at) AS last_viewed_at
FROM public.entry_view_events
GROUP BY entry_id;

COMMENT ON VIEW public.entry_view_stats IS '作品ごとの閲覧数集計';
