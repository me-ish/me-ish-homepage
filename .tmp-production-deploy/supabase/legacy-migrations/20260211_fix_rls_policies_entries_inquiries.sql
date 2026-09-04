-- =====================================================================
-- 20260211_fix_rls_policies_entries_inquiries.sql
-- Fix "RLS Policy Always True" warnings and tighten security
-- =====================================================================

BEGIN;

-- -------------------------------------------------
-- entries: public select should not be USING (true)
-- only show publicly displayable entries
-- -------------------------------------------------
DROP POLICY IF EXISTS "Allow public select" ON public.entries;
CREATE POLICY "Allow public select"
ON public.entries
FOR SELECT
TO public
USING (
  confirmed = true
  AND COALESCE(display_ready, false) = true
);

-- -------------------------------------------------
-- entries: public insert should not be WITH CHECK (true)
-- anonymous submissions must be unconfirmed/unlinked and not display-ready
-- -------------------------------------------------
DROP POLICY IF EXISTS "Allow public insert" ON public.entries;
CREATE POLICY "Allow public insert"
ON public.entries
FOR INSERT
TO public
WITH CHECK (
  confirmed IS NULL
  AND user_id IS NULL
  AND COALESCE(display_ready, false) = false
);

-- -------------------------------------------------
-- entries: linking policy should not have WITH CHECK (true)
-- If user_id is set (by linking), it must be the current user.
-- -------------------------------------------------
DROP POLICY IF EXISTS "Allow linking for entries without user_id" ON public.entries;
CREATE POLICY "Allow linking for entries without user_id"
ON public.entries
FOR UPDATE
TO authenticated
USING (user_id IS NULL)
WITH CHECK (user_id = auth.uid());

-- -------------------------------------------------
-- inquiries: admin update should not be USING/WITH CHECK (true)
-- -------------------------------------------------
DROP POLICY IF EXISTS "Allow admin update" ON public.inquiries;
CREATE POLICY "Allow admin update"
ON public.inquiries
FOR UPDATE
TO authenticated
USING (auth.uid() = 'b3211e93-a630-4826-8e78-5a50db043170'::uuid)
WITH CHECK (auth.uid() = 'b3211e93-a630-4826-8e78-5a50db043170'::uuid);

COMMIT;
