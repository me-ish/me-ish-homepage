# Production source synchronization, 2026-10-26

This snapshot brings GitHub main forward from 804719d53fd4a54c04c36a253a13f3a26d75d4fd to the application already deployed from ccd4ffc8b7742d2cbf5801bf4e4940c82ddbf73a, plus one display fix. It is a single new commit on the existing main ancestry; the 87 local development/evidence commits are preserved privately and are not published by this snapshot.

## Application change relative to the deployed source

The shared case-workspace entry no longer claims that production cutover is unperformed when the existing release-target validator confirms a production deployment. The management navigation is preserved. The feature flags, authorization, persisted stop/resume controls, data source, payment/notification paths, and automatic seven-day deadline with successful-resend extension are unchanged. Non-production validation previews retain the notice.

The existing Next 15.5.27 font compatibility patch, postinstall hook and lockfile are included. No package upgrade is introduced here.

## Database/source record

See [the already-applied SQL archive](../supabase/operations/production-applied-20261025/README.md) and its manifest for all 17 actual payloads and their production history versions. The historical source files are retained unchanged; the 16th production-compatible payload is recorded separately. The optional new mail-evidence profile is not installed in production. No SQL is applied by this synchronization, build or deployment.

## Validation and limits

- Node 22.23.3: 136 focused tests passed across the production-entry display, target guards, persistent stop behavior, current payment terms, quote notification and result handling.
- TypeScript check passed; source ESLint passed with two existing AnnouncementCard image warnings.
- Full managed-production-shape Next build passed, including type/lint and 186 generated static pages. External sockets were denied; target/credentials and the Google-font transport used local synthetic fixtures. This does not claim a live-provider or visual-font test.
- The only changed application runtime file relative to the prior deployed source is CaseWorkspaceEntryPage.tsx. New regression tests and this source/database record are supporting files.
- No real email, live payment, customer-case edit, backup restore, or Storage-object copy is performed by the synchronization.

New internal execution reports, screenshots, credentials, environment files, customer rows and attachments are excluded from publication. Previously public documentation is retained from main. All application source, tests, scripts, configuration and static public assets are included for independent whole-system review.
