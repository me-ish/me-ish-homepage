# Production source synchronization, 2026-10-26

This snapshot brings GitHub main forward from 804719d53fd4a54c04c36a253a13f3a26d75d4fd to the application already deployed from ccd4ffc8b7742d2cbf5801bf4e4940c82ddbf73a, plus one display fix. It is a single new commit on the existing main ancestry; the 87 local development/evidence commits are preserved privately and are not published by this snapshot.

## Application change relative to the deployed source

The shared case-workspace entry no longer claims that production cutover is unperformed when the existing release-target validator confirms a production deployment. The management navigation is preserved. The feature flags, authorization, persisted stop/resume controls, data source, payment/notification paths, and automatic seven-day deadline with successful-resend extension are unchanged. Non-production validation previews retain the notice.

The existing font compatibility patch and postinstall hook are preserved. The CI follow-up updates Next within 15.x to 15.5.28, with its matching lint configuration, pins Zod 4.6.6, and constrains the indirect DOMPurify dependency to 3.4.17. These address the production dependency audit without an unrestricted audit fix or a major-version migration. The font loader's original bytes are identical across the two Next patch releases; the same bounded patch and eight regression cases are retained for 15.5.28.

The follow-up also fixes operation-result GET queries: absent `p_id`/`p_kind` arguments are omitted so PostgreSQL uses its NULL defaults. The SDK otherwise serializes null as text, which incorrectly filters out the recorded operation. Latest and exact-operation recovery remain reads; unresolved results are not treated as successful execution or permission to resend.

Legacy CI profiles now provision the exact existing admission foundation and latest admission function into their disposable fixtures. Product guards are unchanged. Additional real-DB checks ensure a persisted stop still denies writes/sends while retaining reads and pending notifications. The E2E job uses Ubuntu 24.04, supported by its existing Playwright version, rather than the incompatible Ubuntu 26.04 runner.

## Database/source record

See [the already-applied SQL archive](../supabase/operations/production-applied-20261025/README.md) and its manifest for all 17 actual payloads and their production history versions. The historical source files are retained unchanged; the 16th production-compatible payload is recorded separately. The optional new mail-evidence profile is not installed in production. No SQL is applied by this synchronization, build or deployment.

## Validation and limits

- Node 22.23.3: 136 focused tests passed across the production-entry display, target guards, persistent stop behavior, current payment terms, quote notification and result handling.
- TypeScript check passed; source ESLint passed with two existing AnnouncementCard image warnings.
- Full managed-production-shape Next build passed, including type/lint and 186 generated static pages. External sockets were denied; target/credentials and the Google-font transport used local synthetic fixtures. This does not claim a live-provider or visual-font test.
- The initial snapshot changed only CaseWorkspaceEntryPage.tsx relative to the prior deployed application. The CI follow-up additionally fixes the omitted GET selectors in caseCurrentFlow.ts and updates the specific dependencies listed above. New regression tests, disposable fixture prerequisites, and source/database records support those changes.
- No real email, live payment, customer-case edit, backup restore, or Storage-object copy is performed by the synchronization.

New internal execution reports, screenshots, credentials, environment files, customer rows and attachments are excluded from publication. Previously public documentation is retained from main. All application source, tests, scripts, configuration and static public assets are included for independent whole-system review.
