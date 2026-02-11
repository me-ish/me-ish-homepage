-- =====================================================================
-- 20260211_enable_rls_server_only_tables.sql
-- Enable RLS on server-only tables to satisfy Security Advisor
-- and prevent any client (anon/authenticated) access.
-- =====================================================================

BEGIN;

-- 0) 念のため権限も剥がす（既に剥がれていてもOK）
REVOKE ALL ON TABLE public.aura_first20_redemptions FROM anon, authenticated;
REVOKE ALL ON TABLE public.aura_meish_free_claims   FROM anon, authenticated;
REVOKE ALL ON TABLE public.aura_promo_counters      FROM anon, authenticated;
REVOKE ALL ON TABLE public.entry_processing_jobs    FROM anon, authenticated;

-- 1) RLS を有効化
ALTER TABLE public.aura_first20_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aura_meish_free_claims   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aura_promo_counters      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_processing_jobs    ENABLE ROW LEVEL SECURITY;

-- 2) anon/authenticated を明示的に拒否するポリシー（安全のため “false”）
--   ※ service_role は RLS をバイパスするのでサーバー処理は影響なし
DROP POLICY IF EXISTS "deny_all_anon" ON public.aura_first20_redemptions;
DROP POLICY IF EXISTS "deny_all_auth" ON public.aura_first20_redemptions;
CREATE POLICY "deny_all_anon" ON public.aura_first20_redemptions
  FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_auth" ON public.aura_first20_redemptions
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_all_anon" ON public.aura_meish_free_claims;
DROP POLICY IF EXISTS "deny_all_auth" ON public.aura_meish_free_claims;
CREATE POLICY "deny_all_anon" ON public.aura_meish_free_claims
  FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_auth" ON public.aura_meish_free_claims
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_all_anon" ON public.aura_promo_counters;
DROP POLICY IF EXISTS "deny_all_auth" ON public.aura_promo_counters;
CREATE POLICY "deny_all_anon" ON public.aura_promo_counters
  FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_auth" ON public.aura_promo_counters
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_all_anon" ON public.entry_processing_jobs;
DROP POLICY IF EXISTS "deny_all_auth" ON public.entry_processing_jobs;
CREATE POLICY "deny_all_anon" ON public.entry_processing_jobs
  FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_auth" ON public.entry_processing_jobs
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

COMMIT;
