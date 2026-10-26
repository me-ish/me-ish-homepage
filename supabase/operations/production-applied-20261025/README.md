# Already-applied production SQL archive

These 17 files record the exact SQL payloads already applied during the 2026-10-25 production cutover. They are evidence for source/database consistency, not a migration queue. Do not execute them again and do not edit existing migration-history rows.

The manifest maps historical source filenames and SHA-256 values to the actual applied payloads and generated production history versions. The original 43 history entries were retained, for 60 total.

The 16th payload deliberately differs from its historical source: it pins the observed production writer variants and replaces the obsolete physical project-delete body with the reviewed soft-delete form. Applying that payload did not update/delete existing project rows. Its original historical migration remains unchanged.

The 17th current-flow forward SQL is also retained in scripts/natori-case-production-upgrade/current-flow.sql. The optional production-mail-evidence migration was NOT applied to production. A generic `supabase db push` would not reconcile these recorded source/history differences; do not run it against this production database as part of Git synchronization.

This Git synchronization performs no database changes, history repair, account changes, test mail, or payment calls.
