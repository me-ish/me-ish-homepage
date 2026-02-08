-- =============================================================================
-- 20250125_sales_payout_management.sql
-- 入金管理を sales をsource of truthに統一
-- =============================================================================

-- =========================================================
-- 1. sales テーブルに精算関連カラムを追加
-- =========================================================

-- me-ish手数料（price * 0.1）
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS meish_fee_yen integer;

-- アーティスト報酬（price * 0.9）
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS artist_reward_yen integer;

-- 振込ステータス: pending / paid
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS payout_status text DEFAULT 'pending';

-- 振込済み日時
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- 振込バッチID（一括振込時のグルーピング用）
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS payout_batch_id uuid;

-- =========================================================
-- 2. 既存データの payout_status を pending に統一
-- =========================================================
UPDATE public.sales
SET payout_status = 'pending'
WHERE payout_status IS NULL;

-- NOT NULL 制約を追加
ALTER TABLE public.sales
  ALTER COLUMN payout_status SET NOT NULL;

-- CHECK 制約でステータス値を限定（冪等）
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_payout_status_check'
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_payout_status_check
      CHECK (payout_status IN ('pending', 'paid'));
  END IF;
END $do$;

-- =========================================================
-- 3. 既存 sales の fee/reward を埋め戻し（purchased_at があるもの）
-- =========================================================
UPDATE public.sales
SET
  meish_fee_yen = floor(price * 0.1),
  artist_reward_yen = floor(price * 0.9)
WHERE
  price IS NOT NULL
  AND purchased_at IS NOT NULL
  AND (meish_fee_yen IS NULL OR artist_reward_yen IS NULL);

-- =========================================================
-- 4. v_my_sales_summary ビューを作成（または更新）
-- =========================================================
DROP VIEW IF EXISTS public.v_my_sales_summary;

CREATE VIEW public.v_my_sales_summary AS
SELECT
  e.user_id,
  -- 総売上（price合計）
  COALESCE(SUM(s.price), 0)::bigint AS gross_sales_yen,
  -- 入金待ち（purchased_at ありで payout_status != 'paid'）
  COALESCE(
    SUM(
      CASE
        WHEN s.purchased_at IS NOT NULL AND s.payout_status != 'paid'
        THEN s.artist_reward_yen
        ELSE 0
      END
    ),
    0
  )::bigint AS pending_payout_yen,
  -- 入金済み（payout_status = 'paid'）
  COALESCE(
    SUM(
      CASE
        WHEN s.purchased_at IS NOT NULL AND s.payout_status = 'paid'
        THEN s.artist_reward_yen
        ELSE 0
      END
    ),
    0
  )::bigint AS paid_out_yen
FROM
  public.entries e
LEFT JOIN public.sales s ON s.entry_id = e.id
WHERE
  e.user_id IS NOT NULL
GROUP BY
  e.user_id;

-- ビューへのSELECT権限
GRANT SELECT ON public.v_my_sales_summary TO authenticated;

-- =========================================================
-- 5. finalize_sale 関数を更新（fee/reward/status を設定）
-- =========================================================
CREATE OR REPLACE FUNCTION public.finalize_sale(
  p_entry_id bigint,
  p_quantity integer,
  p_session_id text,
  p_price integer DEFAULT NULL
)
RETURNS TABLE(new_edition_sold integer, sold_out boolean)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
declare
  v_entry record;
  v_inserted boolean;
  v_fee integer;
  v_reward integer;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be positive';
  end if;

  if p_session_id is null or length(trim(p_session_id)) = 0 then
    raise exception 'session_id must be provided';
  end if;

  -- 手数料と報酬を計算（priceがある場合）
  -- NOTE: v_reward is now computed as p_price - v_fee (see 20260208_fix_fee_rounding.sql)
  if p_price is not null and p_price > 0 then
    v_fee := floor(p_price * 0.1);
    v_reward := floor(p_price * 0.9);
  else
    v_fee := null;
    v_reward := null;
  end if;

  -- ✅ 冪等ゲート：session_id を sales で確保（処理済みなら加算しない）
  insert into public.sales (
    entry_id,
    stripe_session_id,
    price,
    purchased_at,
    meish_fee_yen,
    artist_reward_yen,
    payout_status,
    metadata
  )
  values (
    p_entry_id,
    p_session_id,
    p_price,
    now(),
    v_fee,
    v_reward,
    'pending',
    jsonb_build_object('source', 'finalize_sale')
  )
  on conflict (stripe_session_id) do nothing;

  get diagnostics v_inserted = row_count;

  if not v_inserted then
    -- 既に処理済み：現在値を返して終了
    select e.edition_sold,
           (e.edition_total is not null and coalesce(e.edition_sold,0) >= e.edition_total)
      into new_edition_sold, sold_out
    from public.entries e
    where e.id = p_entry_id;

    return;
  end if;

  -- 対象行をロックして取得
  select * into v_entry
  from public.entries
  where id = p_entry_id
  for update;

  if not found then
    raise exception 'entry % not found', p_entry_id;
  end if;

  -- 在庫チェック（edition_total が null は無制限）
  if v_entry.edition_total is not null then
    if coalesce(v_entry.edition_sold,0) + p_quantity > v_entry.edition_total then
      raise exception 'sold out: requested %, remaining %',
        p_quantity,
        greatest(v_entry.edition_total - coalesce(v_entry.edition_sold,0), 0);
    end if;
  end if;

  -- インクリメント
  update public.entries
     set edition_sold = coalesce(edition_sold,0) + p_quantity
   where id = p_entry_id
   returning edition_sold,
             (edition_total is not null and edition_sold >= edition_total)
        into new_edition_sold, sold_out;

  return;
end;
$$;

-- =========================================================
-- 6. 管理者用：sales の payout_status を一括更新する関数
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_mark_sales_paid(
  p_user_id uuid,
  p_batch_id uuid DEFAULT NULL
)
RETURNS TABLE(updated_count integer, total_amount bigint)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
declare
  v_count integer;
  v_total bigint;
begin
  -- バッチIDがない場合は生成
  if p_batch_id is null then
    p_batch_id := gen_random_uuid();
  end if;

  -- 対象ユーザーの pending sales を paid に更新
  with updated as (
    update public.sales s
    set
      payout_status = 'paid',
      paid_at = now(),
      payout_batch_id = p_batch_id
    from public.entries e
    where
      s.entry_id = e.id
      and e.user_id = p_user_id
      and s.payout_status = 'pending'
      and s.purchased_at is not null
    returning s.artist_reward_yen
  )
  select count(*)::integer, coalesce(sum(artist_reward_yen), 0)::bigint
  into v_count, v_total
  from updated;

  updated_count := v_count;
  total_amount := v_total;
  return next;
end;
$$;

-- =========================================================
-- 7. 管理者用：振込待ち一覧を取得するビュー
-- =========================================================
DROP VIEW IF EXISTS public.v_pending_payouts;

CREATE VIEW public.v_pending_payouts AS
SELECT
  e.user_id,
  p.display_name,
  p.avatar_url,
  COUNT(s.id)::integer AS pending_count,
  COALESCE(SUM(s.artist_reward_yen), 0)::bigint AS pending_amount,
  MIN(s.purchased_at) AS oldest_purchase_at,
  MAX(s.purchased_at) AS latest_purchase_at
FROM
  public.sales s
  JOIN public.entries e ON s.entry_id = e.id
  LEFT JOIN public.profiles p ON e.user_id = p.id
WHERE
  s.payout_status = 'pending'
  AND s.purchased_at IS NOT NULL
  AND e.user_id IS NOT NULL
GROUP BY
  e.user_id,
  p.display_name,
  p.avatar_url
HAVING
  COUNT(s.id) > 0
ORDER BY
  pending_amount DESC;

-- =========================================================
-- 8. RLS ポリシー設定
-- =========================================================

-- sales テーブルの RLS を有効化（すでに有効なら無視）
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- 既存ポリシーを削除（あれば）
DROP POLICY IF EXISTS sales_select_own ON public.sales;
DROP POLICY IF EXISTS sales_select_buyer ON public.sales;
DROP POLICY IF EXISTS sales_insert_service ON public.sales;
DROP POLICY IF EXISTS sales_update_service ON public.sales;

-- 一般ユーザー：自分の作品に関する sales のみ SELECT 可能
CREATE POLICY sales_select_own ON public.sales
  FOR SELECT
  TO authenticated
  USING (
    entry_id IN (
      SELECT id FROM public.entries WHERE user_id = auth.uid()
    )
  );

-- サービスロール（管理者）のみ INSERT/UPDATE 可能
-- ※ RLS は service_role ではバイパスされるため、
--   一般ユーザーからの直接 UPDATE を防ぐ形となる

-- 購入者が自分の購入を見れるポリシー（buyer_email で）
CREATE POLICY sales_select_buyer ON public.sales
  FOR SELECT
  TO authenticated
  USING (
    buyer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

COMMENT ON TABLE public.sales IS '売上記録。入金管理の source of truth。payout_status で振込ステータスを管理。';
COMMENT ON COLUMN public.sales.payout_status IS 'pending=入金待ち, paid=入金済み';
COMMENT ON COLUMN public.sales.paid_at IS '振込完了日時';
COMMENT ON COLUMN public.sales.payout_batch_id IS '一括振込時のバッチID';
COMMENT ON COLUMN public.sales.meish_fee_yen IS 'me-ish手数料（price * 0.1）';
COMMENT ON COLUMN public.sales.artist_reward_yen IS 'アーティスト報酬（price * 0.9）';
