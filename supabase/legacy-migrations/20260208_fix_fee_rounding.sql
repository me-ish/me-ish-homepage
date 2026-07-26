-- =============================================================================
-- 20260208_fix_fee_rounding.sql
-- 手数料端数計算の修正: reward = price - fee で端数ズレを解消
-- =============================================================================

-- =========================================================
-- 1. finalize_sale 関数を更新（reward = price - fee に修正）
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
  -- fee = floor(price * 0.1), reward = price - fee（端数ズレ防止）
  if p_price is not null and p_price > 0 then
    v_fee := floor(p_price * 0.1);
    v_reward := p_price - v_fee;
  else
    v_fee := null;
    v_reward := null;
  end if;

  -- 冪等ゲート：session_id を sales で確保（処理済みなら加算しない）
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
-- 2. 既存データの端数ズレを補正
--    fee + reward != price のレコードを修正
-- =========================================================
UPDATE public.sales
SET artist_reward_yen = price - meish_fee_yen
WHERE
  price IS NOT NULL
  AND meish_fee_yen IS NOT NULL
  AND purchased_at IS NOT NULL
  AND artist_reward_yen != price - meish_fee_yen;
