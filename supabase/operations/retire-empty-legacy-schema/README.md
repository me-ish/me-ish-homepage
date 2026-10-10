# Retire empty legacy schema — reviewed manual cutover

Status: prepared for review; **not applied to production**. Code must deploy first.
Base: main `5d187c02c18644b1280cab90e9a4f1c33f08078c` (PR #152).

The owner-approved 84 legacy rows and 49 Storage registrations were already
removed on 2026-10-10. This operation removes empty definitions, not more records.
`targets.json` is the exact inventory: 15 tables, 5 views, 9 functions, 7 empty
buckets and 15 policies exclusively for those buckets. Four statistics RPCs refer
to the target views indirectly; retaining them would leave broken public RPCs.

## Application changes

- Old upload, artwork/certificate download and individual comment DELETE return
  the existing 503/no-store pause response, with no DB, Storage or mail imports.
- Remove the obsolete AURA privacy update from account deletion. Authentication,
  payout check, entry hiding, profile anonymization and Auth deletion remain.
- Remove the dead gallery upload helpers and schema types for the targets.
  Types describe the narrower post-cleanup contract; the app also works while
  production still has those obsolete definitions. Do not regenerate from the
  pre-cutover DB and accidentally reintroduce them.
- Phase 0A's 21 active-gallery upload cases become one mandatory real-handler
  retirement test. Its Natori upload/TUS/resume cases and separate bundles remain.
  Two historical isolated legacy-asset permission cases also remain; they do not
  assert that these buckets still exist in production.

## Production sequence (owner approval required)

1. Review CI on this PR; confirm merge/deployment separately. Check Natori public
   portfolio/contact and current operations after the code deploys.
2. Re-run `preflight.sql` and capture `scripts/legacy-service-stop/catalog.sql`.
   Capture count/hash inventory of all retained public tables, Auth IDs/update
   timestamps, Storage objects and bucket settings. Keep actual customer rows
   out of GitHub. The read-only preflight does not reserve the state: the apply
   script repeats its checks under locks.
3. After approval, in a new dedicated session set
   `meish.legacy_schema_cleanup = 'reviewed-20261010'`, then execute
   `20261010120011_retire_empty_legacy_schema.sql` as one transaction. Never set
   the acknowledgement globally. The file was scaffolded with Supabase CLI
   `migration new` and intentionally moved out of `supabase/migrations`: neither
   application deployment nor migration replay may run this irreversible step.
4. Compare the new catalog with `verify-delta.py BEFORE AFTER schema`; compare
   the retained data inventory. Expected public table count is 63 → 48, with no
   row loss (629 at the 2026-10-10 baseline). Abort/review any fresh row or drift.
5. Reconfirm each of the seven named buckets is empty and that Natori's four
   buckets/45 objects match the captured inventory. Delete ONLY those empty
   seven buckets using Supabase Storage API `deleteBucket` or the dashboard.
   Never use SQL DELETE on `storage.buckets` or `storage.objects`. Do not call
   `emptyBucket` here: newly arrived files must cause a stop, not be removed.
6. After all seven buckets are absent, set session-local intent via
   `meish.legacy_storage_cleanup = 'reviewed-20261010'` in a dedicated session and
   run `remove-storage-policies.sql`. This second transaction refuses if any old
   bucket/object remains or any target policy differs from the reviewed catalog.
   Compare catalog with `verify-delta.py BEFORE AFTER storage` and recheck all
   retained objects/bucket settings. Both SQL operations preserve Natori rules.
7. Recheck public JSON and 21 image hashes, public/contact pages, runtime errors
   and security advisors; save the actual results in the cleanup plan.

The table operation requires exact current columns/defaults/constraints and
function/view definitions. ACCESS EXCLUSIVE locks prevent insertion between the
emptiness check and DROP; lock timeout is 3 seconds. No CASCADE, wildcard DROP,
DML or auto-retry exists. An unknown FK/view dependency fails with RESTRICT and
rolls the whole transaction back. Remaining public function source is checked
for direct/indirect target identifiers as PostgreSQL does not track references
inside string function bodies. This is not a substitute for source review of
external callers or dynamically constructed SQL.

The storage SQL removes 12 permissive and 3 restrictive old-only policies, only
after buckets are absent. Recreating retired buckets is outside the plan.

## Preserved and excluded

All Natori tables/functions and four Storage buckets; shared Stripe event
processing; Auth; existing shared admin/support and account deletion; historical
entries, certificates, bank accounts and profiles. No Stripe payment, email,
refund, real form submission or production mutation is performed by this PR.
The certificate page can still display retained historical metadata; its old
artwork download endpoints are intentionally stopped after the approved asset
deletion. Natori delivery endpoints are separate and unchanged.

Old migrations/baselines are historical records and stay intact. Existing
`braces` audit failure is separately deferred. Further old history removal needs
its own concrete inventory/approval. Successful structural tests do not prove
real provider/payment/mail acceptance.

## Verification

`Retire empty legacy schema` uses PostgreSQL 17.6 in a dedicated disposable
container with no network or published ports, synthetic rows and exact target
columns/constraints/functions/views. It exercises missing acknowledgement,
non-empty table refusal, structural/function/view drift, new function/FK/view
dependencies, atomic rollback, repeat refusal, bucket-before-policy ordering,
policy drift, exact remaining catalog and protected data equality.

The gate does not emulate Supabase-managed event triggers, Storage API or all
Natori business tables. Existing Natori integration CI verifies actual Natori
flows independently. Production is only inspected read-only before approval.

Sources: [Supabase deleteBucket](https://supabase.com/docs/reference/javascript/storage-deletebucket),
[PostgreSQL DROP TABLE](https://www.postgresql.org/docs/17/sql-droptable.html).
