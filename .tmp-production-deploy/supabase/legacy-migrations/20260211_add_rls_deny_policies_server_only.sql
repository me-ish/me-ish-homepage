-- =====================================================================
-- 20260211_add_rls_deny_policies_server_only.sql
-- RLS is enabled but no policies exist => add explicit deny policies
-- to lock tables as server-only (service_role/admin).
-- =====================================================================

BEGIN;

-- 1) admin_emails
DROP POLICY IF EXISTS "deny_all_anon" ON public.admin_emails;
DROP POLICY IF EXISTS "deny_all_auth" ON public.admin_emails;
CREATE POLICY "deny_all_anon" ON public.admin_emails
  FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_auth" ON public.admin_emails
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 2) artists_bank_accounts (sensitive)
DROP POLICY IF EXISTS "deny_all_anon" ON public.artists_bank_accounts;
DROP POLICY IF EXISTS "deny_all_auth" ON public.artists_bank_accounts;
CREATE POLICY "deny_all_anon" ON public.artists_bank_accounts
  FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_auth" ON public.artists_bank_accounts
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 3) cert_links
DROP POLICY IF EXISTS "deny_all_anon" ON public.cert_links;
DROP POLICY IF EXISTS "deny_all_auth" ON public.cert_links;
CREATE POLICY "deny_all_anon" ON public.cert_links
  FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_auth" ON public.cert_links
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 4) payout_batches
DROP POLICY IF EXISTS "deny_all_anon" ON public.payout_batches;
DROP POLICY IF EXISTS "deny_all_auth" ON public.payout_batches;
CREATE POLICY "deny_all_anon" ON public.payout_batches
  FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_auth" ON public.payout_batches
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

COMMIT;
