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

Current status: database application and production type/ACL verification are
complete. The application switch remains pending until this evidence is merged.

## Evidence recorded on 2026-08-08 JST

Production project `lvnfspyainrxtztjytbo` was first inspected with SELECT-only
catalog and aggregate queries. At preflight, no production DDL, DML, RPC
invocation, migration-history change, type generation, or application deployment
had been performed.

- project status: active/healthy, PostgreSQL 17;
- migration history: 13 rows, latest version `20260805132721`;
- `natori_accept_delivery_rpc`: not recorded;
- `public.natori_accept_delivery_v1(text)`: absent;
- P1-10 delivery activity trigger: present and enabled;
- `service_role` has SELECT and UPDATE on `public.natori_projects`;
- accepted/completed status anomalies: 0;
- duplicate non-null delivery-token hash groups: 0;
- currently eligible production deliveries at inspection time: 0.

After explicit approval from `me-ish`, the reviewed function-only migration was
applied through the Supabase migration API. No baseline replay, history repair,
table DDL, project DML, or production RPC invocation was performed.

- reviewed Git commit: `95612d402aa456d2a3f48615d1945b1ade3d43ba`;
- migration file SHA-256:
  `DDA7AFED26145D068ED7B2A00542F13587F0BA40015CE30EABCF672C2DC4B373`;
- production migration version: `20260807215620`;
- production migration name: `natori_accept_delivery_rpc`;
- all seven SELECT-only post-migration anomaly counts: 0;
- production-generated RPC type: exact match with `src/types/supabase.ts`;
- effective EXECUTE: function owner and `service_role` only;
- Security Advisor: unchanged at 93 findings (2 ERROR, 86 WARN, 5 INFO);
- accepted/completed anomalies and duplicate delivery-token groups: 0.

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

- executor: Codex session acting under the repository owner's approval;
- approver and rollback/application owner: `me-ish`;
- approval: explicit in the task thread on 2026-08-08 JST;
- observation window: PR merge through completion of main CI, production Vercel
  deployment, and the immediate post-deploy read-only verification;
- history-safe procedure: apply only the reviewed function migration through the
  Supabase migration API and record its generated hosted version/name;
- application rollback target: the production deployment for main commit
  `6f0004ba949ba248c33f90b93f9231be990f7c94` immediately before PR #18;
- backup/PITR metadata: not exposed by the connected management API. The approved
  change is additive function DDL with no DML; its immediate rollback is app-first
  and leaves the additive function installed.

Before applying anything, record the exact Git SHA and SHA-256 of
`supabase/migrations/20260806120330_natori_accept_delivery_rpc.sql`. Run
`supabase/verification/etorie-p1-12-delivery-acceptance-selects.sql` as a
preflight: before migration only the RPC contract/ACL/history checks are expected
to report 1; trigger, data-integrity, and duplicate-token checks must report 0.
Abort for any other result.

## Apply and verify

Completed before application merge:

1. the migration API applied exactly the reviewed function migration and added
   one history row; active baseline/history rows were not replayed or repaired;
2. the SELECT-only verification SQL returned 0 for all seven anomaly counts;
3. production-generated TypeScript types were compared in memory without
   overwriting the canonical file;
4. the generated argument is `p_token_hash: string`; returned fields are
   `accepted_at`, `client_name`, `project_id`, `project_title`, and `result`;
5. catalog privileges confirm `service_role` can execute and anon/authenticated
   cannot;
6. the mutating RPC was not invoked against a production row;
7. synthetic success, rejection, retry, and concurrency cases passed in the
   dedicated non-production environment.

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
