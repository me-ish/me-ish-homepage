-- =============================================================================
-- 20260208_payout_tables.sql
-- Payout関連テーブルの定義（冪等: CREATE TABLE IF NOT EXISTS）
-- 本番では既に存在するテーブルだが、migration履歴を正規化するために追加
-- =============================================================================

-- =========================================================
-- 1. payouts テーブル（個別ユーザーへの振込記録）
-- =========================================================
CREATE TABLE IF NOT EXISTS public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_ym text NOT NULL,
  amount_yen bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT payouts_status_check CHECK (status IN ('pending', 'closed', 'paid'))
);

-- ユニーク制約: 同一ユーザー・同一期間に重複振込を防止
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payouts_user_period_unique'
  ) THEN
    ALTER TABLE public.payouts
      ADD CONSTRAINT payouts_user_period_unique UNIQUE (user_id, period_ym);
  END IF;
END $$;

-- =========================================================
-- 2. payout_items テーブル（振込に含まれる個別売上の紐付け）
-- =========================================================
CREATE TABLE IF NOT EXISTS public.payout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id uuid NOT NULL REFERENCES public.payouts(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 3. payout_batches テーブル（月次締めバッチ記録）
-- =========================================================
CREATE TABLE IF NOT EXISTS public.payout_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_ym text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'closed',
  closed_at timestamptz,
  total_amount_yen bigint DEFAULT 0,
  artist_count integer DEFAULT 0,
  sale_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT payout_batches_status_check CHECK (status IN ('closed', 'processing', 'paid'))
);

-- =========================================================
-- 4. RLS 設定
-- =========================================================
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_batches ENABLE ROW LEVEL SECURITY;

-- 一般ユーザーは自分の振込記録のみ閲覧可能
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'payouts_select_own'
  ) THEN
    CREATE POLICY payouts_select_own ON public.payouts
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
