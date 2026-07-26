-- 20260209_admin_audit_log.sql
-- Admin audit log table for tracking admin actions

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  detail jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
  ON admin_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action
  ON admin_audit_log (action);

-- RLS: service_role only (INSERT / SELECT)
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_insert" ON admin_audit_log;
CREATE POLICY "service_role_insert" ON admin_audit_log
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_select" ON admin_audit_log;
CREATE POLICY "service_role_select" ON admin_audit_log
  FOR SELECT TO service_role
  USING (true);
