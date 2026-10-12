# PAY-01 deployment and acceptance procedure

This procedure is a review candidate, not authorization for production changes.
The PAY-01 branch is based on `main` at
`9abcd1310aba049d512221c2786119af06b12e35`, independently of Draft PRs #162
and #163. Merge, production deployment, database/permission changes and any
existing-row repair require the owner's approval of the exact operation and
impact. Confirm whether a merge to `main` automatically deploys before approval.

## Result and scope

Ordinary admin status PATCH, advance and Undo cannot enter or leave `delivered`
or `completed`, including a same-status PATCH at either boundary. Dedicated
delivery publication and requester acceptance retain their own validation and
transactional persistence. A manually registered historical completed project
retains its original paid/completed dates without inventing customer acceptance.

The new forward migration is
`20261012064005_natori_pay01_completion_evidence.sql`. It protects the first
completion and delivery/acceptance facts in the database, and seals release
creation/acceptance behind the existing dedicated issue and acceptance RPCs.
Their reviewed function bodies must pass the migration's prerequisite checks;
function drift is a stop condition, not permission to overwrite it.

Release reads remain available to the service. Direct service INSERT/UPDATE on
`natori_delivery_releases` are removed. Only the two existing issue/accept RPCs
use the trusted database owner, an empty search path and service-only EXECUTE.
Browser roles receive no new grants. Project metadata/payment projections that
retain the protected facts continue to work; the existing terminal task lock
remains in force. The migration does not update any existing business row.

## Before the approved change window

1. Pin the approved code SHA, migration checksum and verification evidence.
   Name the executor, deployment target, database target and recovery owner.
   Confirm current `main`, open PRs and any concurrent operator changes. If #162
   or #163 has since landed, integrate the current base and run affected checks.
2. Check only necessary database metadata: reviewed delivery and task
   prerequisites, function definitions/owners/configuration and effective ACLs,
   enabled triggers and the named migration's application state. Do not fetch
   customer rows, storage objects, credentials or `.env*` contents. Unexpected
   definitions, grants, disabled triggers or a prior application stop this plan.
3. Confirm the existing dedicated delivery route is configured:
   `NATORI_DELIVERY_INTEGRITY_ENABLED` and `NATORI_ACCEPTANCE_OUTBOX_ENABLED`.
   The legacy delivery-mail fallback is deliberately disabled before token
   mutation or provider sending. A missing configuration returns
   `not-configured`; it must not produce an apparent delivery success. Check
   configuration through the approved operator process without printing values.
4. Confirm a usable backup/recovery procedure and an explicitly owned synthetic
   acceptance record. Live functional checks, mail/provider sending and access
   to existing records need their own approved scope. Automated fixture success
   does not authorize sending customer mail.

## Ordered application

1. Hold affected admin status/delivery operations and requester acceptance during
   the cutover so old and new writers cannot cross the protection boundary.
2. Deploy the exact reviewed secure code first. This removes the generic
   completion write and stops the legacy delivery-mail path before side effects.
   Keep the hold in place until the database and acceptance checks are complete.
3. Apply only the named PAY-01 forward migration, using the approved privileged
   operator. Do not run ordinary full-lane `supabase db push`, replay the frozen
   baseline/archives, or repair migration history. Full active replay has a
   separate pre-existing migration 7 duplicate-CHECK blocker.
4. Verify function body fingerprints, trusted owners, empty search paths,
   service-only issue/accept EXECUTE, release effective SELECT-only service
   access, browser denial and the INSERT/UPDATE project guard. Confirm the
   migration completed atomically and the deployed code SHA is the approved SHA.
5. In the approved synthetic scope, confirm formal publication → `delivered` →
   requester acceptance → `completed`, matching immutable acceptance/completion
   timestamps, retries without duplicate notifications, refusal of generic
   advance/Undo and completion writes, failure rollback and competing updates.
   Check ordinary production-stage progress/Undo, metadata correction and manual
   historical registration without fabricated receipt facts.
6. Release the hold only after the approved acceptance succeeds. Observe status
   mutation failures and delivery/receipt errors; investigate unexpected failures
   without granting broad table permissions or clearing protected evidence.

## Recovery and existing inconsistencies

Keep the new database protection and a secure code artifact if acceptance fails.
The pre-PAY-01 UI/API or legacy delivery-mail branch is not a safe rollback: it
can attempt unreceived completion or send mail before a rejected status write.
Keep the affected routes held and repair forward, or use a reviewed artifact
that retains the generic boundary and dedicated delivery/acceptance routes.
Restoring direct release writes or changing database privileges requires a
separate reviewed operation and explicit approval.

This change does not establish how many existing projects have inconsistent
`completed_at`/`delivery_accepted_at`, and it does not clear or backfill them.
Any investigation beyond catalog metadata must first define an approved,
minimal scope. Each repair needs the exact affected records, actual completion
or receipt evidence, impact and recovery plan; customer acceptance must not be
fabricated. Payment amount, paid dates, files, tokens and historical completed
records are outside automatic conversion.

## Verification limits

The dedicated PAY-01 database acceptance uses generated records and exact named
historical SQL in disposable native PostgreSQL. API/service/component tests are
separately identified in the checkpoint. These results do not prove production
application, real provider mail delivery, customer data repair, all active
migration replay or compatibility with an unreviewed target definition. The
production preparation and approval gates above remain required.
