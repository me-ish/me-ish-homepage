# Legacy migrations

This directory is evidence-only. It preserves the 55 local migrations that
predate the Etorie baseline; it is not the active migration replay path.

- Active migrations live in `supabase/migrations/`.
- Do not target this directory with `supabase db push` or `supabase migration up`.
- The archived set contains duplicate versions and versions whose remote-history
  status is not uniform, so chronological bulk replay is unsupported.
- Build a fresh verification database from the active baseline migration,
  baseline security hardening, and later active migrations.
- The three remote-only history records remain as recovery evidence under
  `docs/migration-recovery/`; no synthetic migration files were created for them.
- The SQL files in this directory must remain byte-identical. Do not reformat,
  edit, split, combine, rename, or annotate them.
- Deletion requires explicit approval from the migration owner, security
  reviewer, and rollback owner, plus retained checksum and recovery evidence.
- The authoritative filename, path, size, status, replay classification, and
  raw-byte SHA-256 ledger is `supabase/baseline/legacy-migrations.json`.
