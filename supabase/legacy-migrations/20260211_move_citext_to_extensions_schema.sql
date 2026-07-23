-- =====================================================================
-- 20260211_move_citext_to_extensions_schema.sql
-- Move citext extension out of public schema (Security Advisor hardening)
-- =====================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;

ALTER EXTENSION citext SET SCHEMA extensions;

COMMIT;
