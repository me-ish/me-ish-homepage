-- ========================================
-- Migration: entry_comments
-- 作品コメント機能
-- Created: 2026-02-06
-- ========================================

-- ============================================================
-- 1. entry_comments テーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS public.entry_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id bigint NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- コメント本文（最大1000文字）
  body text NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 1000),

  -- 表示用の著者名（投稿時点でのdisplay_name）
  author_name text NOT NULL DEFAULT 'Anonymous',

  -- ソフト削除
  deleted_at timestamptz DEFAULT NULL,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_entry_comments_entry
  ON public.entry_comments(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_comments_user
  ON public.entry_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_entry_comments_created
  ON public.entry_comments(created_at DESC);
-- 作品別の未削除コメント取得用（部分インデックス）
CREATE INDEX IF NOT EXISTS idx_entry_comments_entry_active
  ON public.entry_comments(entry_id, created_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.entry_comments IS '作品へのコメント';
COMMENT ON COLUMN public.entry_comments.author_name IS '投稿時点での表示名';
COMMENT ON COLUMN public.entry_comments.deleted_at IS 'ソフト削除日時（NULLなら有効）';
COMMENT ON COLUMN public.entry_comments.deleted_by IS '削除を実行したユーザーID';

-- ============================================================
-- 2. RLS ポリシー
-- ============================================================
ALTER TABLE public.entry_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: 公開作品の未削除コメントは誰でも読める
CREATE POLICY "entry_comments_select_public" ON public.entry_comments
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.entries e
      WHERE e.id = entry_id
        AND e.confirmed = true
        AND e.display_ready = true
    )
  );

-- SELECT: 作品オーナーは削除済みコメントも見れる（モデレーション用）
CREATE POLICY "entry_comments_select_owner" ON public.entry_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.entries e
      WHERE e.id = entry_id AND e.user_id = auth.uid()
    )
  );

-- INSERT: 認証ユーザーが公開作品にコメント
CREATE POLICY "entry_comments_insert" ON public.entry_comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.entries e
      WHERE e.id = entry_id
        AND e.confirmed = true
        AND e.display_ready = true
    )
  );

-- UPDATE: コメント投稿者 または 作品オーナーがソフト削除可能
CREATE POLICY "entry_comments_soft_delete" ON public.entry_comments
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.entries e
      WHERE e.id = entry_id AND e.user_id = auth.uid()
    )
  );

-- ============================================================
-- 3. コメント数集計ビュー
-- ============================================================
CREATE OR REPLACE VIEW public.entry_comment_counts AS
SELECT
  entry_id,
  COUNT(*)::int AS comment_count
FROM public.entry_comments
WHERE deleted_at IS NULL
GROUP BY entry_id;

COMMENT ON VIEW public.entry_comment_counts IS '作品ごとのコメント数集計';
