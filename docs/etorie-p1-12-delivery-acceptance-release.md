# Etorie P1-12 delivery acceptance release runbook

## Scope and current decision

P1-12 moves requester delivery acceptance from multiple application writes to
`public.natori_accept_delivery_v1(text)`. The function locks one project row,
revalidates the paid/active/delivered/unexpired state, completes the project in
one update, and lets the P1-10 activity trigger participate in the same
transaction.

The database migration is additive, but the application switch is not backward
compatible with a database where the RPC is absent. Deploy in this order only:

1. apply and verify the database migration;
2. regenerate production types and compare the RPC signature;
3. deploy the application switch.

Do not merge or deploy the application switch first. Do not run the repository's
normal `supabase db push` against production: the active repository versions and
the production history versions are intentionally not aligned yet, and P0-01's
hybrid history gate still applies.

## Evidence recorded on 2026-08-08 JST

Production project `lvnfspyainrxtztjytbo` was inspected with SELECT-only catalog
and aggregate queries. No production DDL, DML, RPC invocation, migration-history
change, type generation, or application deployment was performed.

- project status: active/healthy, PostgreSQL 17;
- migration history: 13 rows, latest version `20260805132721`;
- `natori_accept_delivery_rpc`: not recorded;
- `public.natori_accept_delivery_v1(text)`: absent;
- P1-10 delivery activity trigger: present and enabled;
- `service_role` has SELECT and UPDATE on `public.natori_projects`;
- accepted/completed status anomalies: 0;
- duplicate non-null delivery-token hash groups: 0;
- currently eligible production deliveries at inspection time: 0.

The dedicated non-production project `rlpljepcdreenjwwxrmg`
(`me-ish-etorie-baseline-test`) contained the ten prerequisite migrations. The
reviewed migration was applied there as version `20260807213658`, name
`natori_accept_delivery_rpc`.

Verified in that environment:

- exact argument and five-column return signature;
- `SECURITY INVOKER` with an exactly empty `search_path`;
- effective EXECUTE only for the function owner and `service_role`;
- generated Supabase TypeScript RPC signature matches `src/types/supabase.ts`;
- accepted, retry-after-expiry, unpaid, expired, archived, invalid-state,
  not-found, and malformed-hash outcomes;
- rejected outcomes do not change acceptance/completion state;
- acceptance writes both timestamps and completed state together;
- one `delivery_accepted` activity is recorded for acceptance plus retry;
- two concurrent calls returned `accepted` and `already-accepted`, with one
  completed project state and one activity row.

Transaction-scoped matrix fixtures rolled back with zero residual rows. The one
committed concurrency fixture and its activity were removed after verification;
the final check found zero residual fixtures and zero orphan activities. The
non-production migration remains installed for future verification.

## Production preflight

The release remains blocked while any value below is missing:

- executor: `operator_confirmation_required`;
- approver, separate from executor: `operator_confirmation_required`;
- rollback/application owner: `operator_confirmation_required`;
- maintenance/observation window: `operator_confirmation_required`;
- latest backup or PITR restore point and restore authority:
  `operator_confirmation_required`;
- reviewed history-safe application procedure compatible with the current
  remapped production migration history: `operator_confirmation_required`;
- current and previous compatible Vercel deployment IDs:
  `operator_confirmation_required`.

Before applying anything, record the exact Git SHA and SHA-256 of
`supabase/migrations/20260806120330_natori_accept_delivery_rpc.sql`. Run
`supabase/verification/etorie-p1-12-delivery-acceptance-selects.sql` as a
preflight: before migration only the RPC contract/ACL/history checks are expected
to report 1; trigger, data-integrity, and duplicate-token checks must report 0.
Abort for any other result.

## Apply and verify

Use the separately reviewed history-safe procedure. It must apply exactly the
reviewed migration body and record one migration-history row named
`natori_accept_delivery_rpc`; it must not replay the active baseline or rewrite
unrelated history rows.

Immediately afterward:

1. run the SELECT-only verification SQL; every anomaly count must be 0;
2. generate TypeScript types from production without writing over the canonical
   file, and compare only the `natori_accept_delivery_v1` signature;
3. confirm the generated argument is `p_token_hash: string` and the returned
   fields are `accepted_at`, `client_name`, `project_id`, `project_title`, and
   `result`;
4. confirm `service_role` can execute and anon/authenticated cannot via catalog
   privileges; do not invoke the mutating RPC against a real production row;
5. deploy the application-switch commit and smoke-test a synthetic case only in
   the approved non-production environment.

The inspection found no currently eligible production delivery, so a production
success-path canary is neither available nor required for this release.

## Monitoring and abort conditions

During the named observation window, monitor delivery-accept API 5xx responses,
unexpected `invalid-state` results, accepted/completed anomaly counts, and the
one-to-one relationship between newly accepted projects and
`delivery_accepted` activity rows.

Stop or roll back the application for any of the following:

- RPC missing or schema-cache/signature mismatch;
- anon/authenticated can execute the RPC;
- acceptance leaves only one of the two completion timestamps;
- accepted project status is not `completed`;
- duplicate acceptance activity;
- unexplained migration-history change;
- any unrelated schema/data diff.

## Rollback order

If the application switch fails, roll back the Vercel deployment first. The old
application does not call the additive RPC, so leaving the function installed is
the safest immediate database state.

Do not drop or revoke the RPC while any deployed application may call it. After
all callers are confirmed rolled back, the database owner may use a separately
approved transaction to revoke `service_role` EXECUTE and drop only
`public.natori_accept_delivery_v1(text)`. Reconcile its migration-history row
only through the approved P0-01 history procedure; never delete or repair history
ad hoc.

Already accepted projects are business events and are not reversed by removing
the function. A data rollback requires a separate incident decision and must not
be bundled into this schema rollback.
