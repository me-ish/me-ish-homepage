-- 20260211_fix_v_pending_payouts_security_invoker.sql
ALTER VIEW public.v_pending_payouts SET (security_invoker = true);
