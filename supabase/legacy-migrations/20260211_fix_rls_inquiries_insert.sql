-- =====================================================================
-- 20260211_fix_rls_inquiries_insert.sql
-- Fix "RLS Policy Always True" for inquiries_insert_anon
-- =====================================================================

BEGIN;

DROP POLICY IF EXISTS inquiries_insert_anon ON public.inquiries;

CREATE POLICY inquiries_insert_anon
ON public.inquiries
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- required fields must be non-empty
  length(trim(name)) > 0
  AND length(trim(email)) > 0
  AND length(trim(message)) > 0

  -- do not allow client to mark as read on insert
  AND COALESCE(is_read, false) = false
);

COMMIT;
