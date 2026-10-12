# PR #162 application conditions and evidence limits

## Evidence, not current-production assertions

The claim that `cert_links` exists and `v_cert_links_active` is absent comes from the prior Work's DB-01 document and [handoff Page](https://chatgpt.com/space/page_a0bcf88f587c8191a2ed18678cacf032), updated 2026-10-11 23:09 UTC. This executor received the report, not its original catalog query/output. The audit Library full-text read contains no independent catalog output for this claim. Current production existence, definition, ACL and application history remain unverified. Do not infer them from `supabase/schema.sql` or archived SQL filenames.

`schema.sql` contains the archived active-view definition, and the archived security SQL specifies an invoker view with browser grants removed. The active Natori lane creates neither `entries` nor certificate tables/views. DB-01 changes entries privileges only: it does not create/restore a certificate view or authorize replay of archived SQL. The standalone acceptance executes that archived predicate in a synthetic fixture and tests its semantics; it is not a full production clone.

## Bank flow classification

- `/settings/bank` is intentionally kept for existing gallery users and settlement support. Login still directs there. It is not retired merely because gallery intake is paused.
- The page itself uses authenticated browser `entries` lookup, `artists_bank_accounts` SELECT and `upsert(...,{onConflict:'external_user_id'})`. No current bank-save API/Server Action is wired into that page.
- `saveBankAccount` is an old gallery-intake Server Action: it is hard-paused and has no remaining product call site. It must not be presented as the live settings-save path.
- The first acceptance fixture used the intermediate `deny_all_auth` policy. A separate archived `20260211_artists_bank_accounts_rls.sql` removes it and defines owner read/insert/update via `v_my_external_user_ids`. The earlier denial was insufficient to diagnose a current production failure.
- The reproducible harness tests the intended owner contract before/after DB-01: linked UID read/update, unlinked-email insert/read, other-owner rejection, service-role reads. All pass. Because the source view's CREATE definition is absent, the fixture explicitly defines a compatible text-valued, owner-filtered invoker view; its current production definition/application is still unknown.
- Natori's current intake, Stripe payments and `confirmNatoriProjectPayment`/`natori_confirm_manual_payment` use Natori tables/ledgers, not `artists_bank_accounts`. The retained legacy bank compatibility is separate from the Natori transaction flow. Relevant login/paused-action/current-payment unit tests pass (45 cases).

Conclusion: no DB-01 regression was reproduced under the intended bank owner contract. A current production bank failure is not established. Operator-side catalog verification and an authorized normal settings-save check remain deployment gates; adding broad grants to force a test to pass is not an approved repair.

## Safe application order for an existing database

1. Approve the exact code SHA, operator, deployment target and DB operation separately. Keep the PR Draft until final CI/review is accepted. Merging the PR is not DB application; verify whether merging main automatically deploys before authorizing a merge.
2. Obtain current read-only catalog evidence for entries (kind/RLS/identity columns/ACL/policies/dependent views), bank table/view contract, certificate table/view predicate and service privileges. No customer values, token hashes or Auth user rows are required. If production was expected to contain entries but does not, investigate rather than treating the migration's fresh-environment no-op as proof of production protection.
3. For certificate display, decide whether the legacy function is still required. If the view already exists, inspect its actual predicate and ACL. If genuinely absent and restoration is required, prepare a separate reviewed forward migration/operation from the observed catalog: active predicate, `security_invoker=true`, no PUBLIC/anon/authenticated read, service-role read, and compatible token-table columns/defaults/PK/FK/expiry types. Do not replay the legacy directory or use a base-table fallback. This PR supplies no authorized production view-restoration migration.
4. With backup and rollback responsibility confirmed, deploy the secure code and apply only `20261011221028_lockdown_legacy_entries_reads.sql` to the established legacy catalog in one approved change window. Prefer secure code first so privileged certificate routes cannot retain the old unauthenticated reissue bypass; until both code and DB steps finish, the P0 is not resolved. Missing-view behavior must remain fail closed. No ordinary full-lane `supabase db push`, baseline replay or history repair on production.
5. Verify the target code SHA, migration result, anonymous effective column SELECT=false, restrictive policies, intended owner/service reads and the approved bank contract. In an isolated environment, verify normal Auth/REST/GraphQL and certificate behavior. Any production functional check requires a designated owned test record/operator and must not enumerate customer certificates or send customer messages. Preserve anonymous denial during rollback/forward recovery.

## Normal certificate prerequisites and claim semantics

- A legitimate supported entry ID, six certificate DTO columns, compatible `cert_links` schema, active view with expiry/revocation/used filtering, and a service-only connection are required.
- `ADMIN_API_TOKEN` must be configured through the approved secret mechanism. A manager verifies the purchaser/record before reissuance. Do not share its value. TTL must be finite and positive. ONE_TIME configuration is fixed when the module starts; record the setting and restart/deploy when changing it.
- The archived view allows null expiry and always excludes used links. Issuance supplies an explicit positive expiry. Successful page display does not reopen paused `/api/files/download` or `/api/cert/download`.
- ONE_TIME now rechecks exact entry ID, unrevoked state, null/future expiry at the claim UPDATE's DB transaction time, and unused state in the conditional UPDATE. Real state changes committed after the view lookup and before that claim are rejected. Eight simultaneous claims produce one success. A later revoke does not retroactively undo a completed claim/render. Non-ONE_TIME validates at the active-view read.
- PDF browser operations, live production certificate availability and every Auth provider configuration are not certified by the password-based local acceptance.

## Fresh replay and scope

The review [discussion_r4243551490](https://github.com/me-ish/me-ish-homepage/pull/162#discussion_r4243551490) correctly identified DB-01's assumption of legacy entries. The revised migration explicitly skips only a missing relation, with a notice, and changes no fresh Natori objects. Any existing unsafe/drifted relation still rejects and rolls back. Dedicated CI covers empty Natori baseline plus lockdown, normal/ invoker wrapper over a private definer, materialized copy, and original legacy authorization guards.

A literal replay of all active files was also attempted. Both main `9abcd131` and the revised working tree stop earlier at migration 7 (`20260801234935_etorie_quote_snapshots_retry.sql`), because it adds `natori_quotes_request_snapshot_object_check` already added by migration 4. `full-active-replay-probe.json` records the identical error; `probe-active-replay.mjs` reproduces it on an owned network-none test container. This is a pre-existing full-lane blocker, not a successful 32-file replay. Frozen baseline/old migration bytes were not rewritten to hide it. Repairing the full fresh lane/history is a separate reviewed task; it is not required to apply this single DB-01 addition to a verified existing legacy database.
