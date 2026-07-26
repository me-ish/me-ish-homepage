-- =====================================================================
-- 20260211_fix_aura_select_own_email_policy.sql
-- Fix: aura_select_own_email references auth.users → permission denied
-- for authenticated role. Use auth.email() (JWT-based) instead.
-- =====================================================================

DROP POLICY IF EXISTS aura_select_own_email ON public.aura_requests;

CREATE POLICY aura_select_own_email ON public.aura_requests
  FOR SELECT TO authenticated
  USING (email = auth.email());
