-- =====================================================================
-- 20260211_fix_function_search_path.sql
-- Fix "Function Search Path Mutable" warnings by pinning search_path
-- for public functions (especially SECURITY DEFINER ones).
-- =====================================================================

BEGIN;

-- SECURITY DEFINER functions (highest priority)
ALTER FUNCTION public.admin_mark_sales_paid(p_user_id uuid, p_batch_id uuid)
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.finalize_sale(p_entry_id bigint, p_quantity integer, p_session_id text)
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.finalize_sale(p_entry_id bigint, p_quantity integer, p_session_id text, p_price integer)
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.get_gallery_stats()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.get_my_artist_view_stats(p_user_id uuid)
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.get_my_viewer_stats(p_user_id uuid)
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.get_my_works_view_stats(p_user_id uuid)
  SET search_path = pg_catalog, public;

-- Non-definer functions (still good hygiene)
ALTER FUNCTION public.consume_cert_token(p_entry_id integer, p_token_hash text, p_one_time boolean)
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.entry_processing_jobs_set_updated_at()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.normalize_unlimited_total()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.set_updated_at()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.touch_updated_at()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.update_updated_at_column()
  SET search_path = pg_catalog, public;

COMMIT;
