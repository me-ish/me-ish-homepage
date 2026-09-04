-- =====================================================================
-- 20260211_fix_sales_select_buyer_policy.sql
-- Fix: sales_select_buyer references auth.users → permission denied
-- when v_my_sales_summary (SECURITY INVOKER) is queried by authenticated users
-- =====================================================================

-- 旧ポリシーを削除（auth.users を直接参照していたため authenticated ロールでエラー）
DROP POLICY IF EXISTS sales_select_buyer ON public.sales;

-- 購入者向け SELECT ポリシーを auth.email() で再作成（JWT から取得、テーブルアクセス不要）
CREATE POLICY sales_select_buyer ON public.sales
  FOR SELECT
  TO authenticated
  USING (buyer_email = auth.email());
