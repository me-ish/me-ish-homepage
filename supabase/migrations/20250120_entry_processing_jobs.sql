-- ========================================
-- Migration: entry_processing_jobs
-- 画像処理ジョブを管理するテーブル
-- Created: 2025-01-20
-- ========================================

-- 1. テーブル作成
CREATE TABLE IF NOT EXISTS public.entry_processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id bigint NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')) DEFAULT 'queued',
  attempts int NOT NULL DEFAULT 0,
  locked_at timestamptz NULL,
  locked_by text NULL,           -- ワーカーID（排他制御用）
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- entry_id は1つのジョブだけ持つ（重複防止）
  CONSTRAINT entry_processing_jobs_entry_id_unique UNIQUE (entry_id)
);

-- 2. インデックス
-- ワーカーがキュー取得時に使う複合インデックス（queued または failed で locked_at が古い/NULLのもの）
CREATE INDEX IF NOT EXISTS idx_entry_processing_jobs_queue
  ON public.entry_processing_jobs (status, locked_at)
  WHERE status IN ('queued', 'failed');

-- entry_id 検索用（UNIQUE制約で自動作成されるが明示）
CREATE INDEX IF NOT EXISTS idx_entry_processing_jobs_entry_id
  ON public.entry_processing_jobs (entry_id);

-- ステータス別集計用
CREATE INDEX IF NOT EXISTS idx_entry_processing_jobs_status
  ON public.entry_processing_jobs (status);

-- 3. updated_at 自動更新トリガー（既存の関数を使用）
DROP TRIGGER IF EXISTS trg_entry_processing_jobs_updated_at ON public.entry_processing_jobs;

CREATE TRIGGER trg_entry_processing_jobs_updated_at
  BEFORE UPDATE ON public.entry_processing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. コメント
COMMENT ON TABLE public.entry_processing_jobs IS '画像処理（Glaze等）のジョブキュー';
COMMENT ON COLUMN public.entry_processing_jobs.status IS 'ジョブ状態: queued(待機), running(処理中), succeeded(成功), failed(失敗)';
COMMENT ON COLUMN public.entry_processing_jobs.attempts IS '試行回数';
COMMENT ON COLUMN public.entry_processing_jobs.locked_at IS 'ワーカーがロックした時刻';
COMMENT ON COLUMN public.entry_processing_jobs.locked_by IS 'ロックしているワーカーのID';
COMMENT ON COLUMN public.entry_processing_jobs.last_error IS '最後のエラーメッセージ';

-- 5. RLS（Row Level Security）- service_role のみ操作可能
ALTER TABLE public.entry_processing_jobs ENABLE ROW LEVEL SECURITY;

-- anon/authenticated からの直接アクセスを禁止
CREATE POLICY "no_client_access" ON public.entry_processing_jobs
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- service_role は全操作可能（API Routes から supabaseAdmin 経由でアクセス）
-- Note: service_role は RLS をバイパスするため、明示的なポリシーは不要
