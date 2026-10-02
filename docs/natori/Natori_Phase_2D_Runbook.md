# Phase 2D - refund ledger and financial results

F21 is additive and depends on reviewed Phase 2C. This phase records signed Stripe refund facts. It does not execute refunds or change business progress, original paid amount/time, delivery acceptance, completion, close/archive or client notifications.

## Runtime gates and rollout

`NATORI_REFUND_LEDGER_ENABLED=1` enables refund routing and completion v2, alongside `NATORI_PAYMENT_INTEGRITY_ENABLED=1`. It also enables owner-scoped refund projections. The independent `NATORI_REFUND_LEDGER_READ_ENABLED=1` keeps those projections enabled while refund writes are disabled. Both flags default off; with both off no refund-ledger read is performed and missing projections never become zero refunds. Apply the additive migration before enabling either flag. Production rollout, DB updates and real customer actions are outside this work.

Supported signed events: `refund.created`, `refund.updated`, `refund.failed`, `charge.refund.updated`, `charge.refunded`. Explicit metadata for another product is ignored. Without a known account/mode-scoped original payment, a metadata-free event remains unclassified/unmatched and visible for review. It is never assigned to Natori by inference.

Mapping retains Payment Intent, charge, account scope, live/test mode and currency. A charge snapshot with `has_more=true` creates an incomplete-list attention item. Its aggregate `amount_refunded` is never counted alongside individual refund IDs. Provider pagination/reconciliation and actual provider testing remain separate verification steps.

## Ledger and financial projections

Refund uniqueness is `(account_scope, livemode, refund_id)`. The ledger retains identity and amount/currency; the durable inbox retains stable normalized signed observations without customer payloads. A later signed observation may fill omitted optional IDs. Differing known values are quarantined. A newer provider state supersedes an older state. Stale pending cannot replace success. Conflicting known states in the same second require review because Stripe timestamps do not establish their order. A strictly later observation can resolve ordering uncertainty; identity conflicts stay quarantined.

Only succeeded refunds with a confirmed timestamp, original received-transaction match, trusted owner, matching currency and positive amount within the original total contribute to confirmed refunds. Pending, requires-action, failed, canceled, unmatched and review records do not count. Later failure may remove a previously confirmed refund from totals while retaining its confirmed timestamp for audit. Original transaction locks prevent simultaneous partial refunds exceeding the original amount.

Original gross results and CSV column index/meaning stay intact. Confirmed refund, net and refund status columns are appended. `net = original gross - confirmed refunds`. Existing paid/completed active-project scope and completed-date grouping stay intact. Unknown gross amounts retain their previous exclusion from known aggregate gross. Missing/unavailable projections do not manufacture zero refunds.

A paid legacy original without trusted platform scope, known live/test mode, JPY currency, matching original session and Payment Intent/charge mapping reports `originalMapped=false`, `confirmedAmount=null`, and a read-only `refund_history_unverified` attention item. Gross is retained. Refund/net numeric CSV cells are blank, and aggregate refund/net remain unknown. Reading this information creates no historical mails and changes no project/transaction facts. A trusted mapped original with no observed refund can report observed-ledger zero when the feature gate is enabled; this does not certify complete provider history. Actual webhook profile/history verification remains pending.

Full/partial/pending/review refund states are independent from production status. The application never automatically closes, reopens or continues a project in response to a refund.

## Notifications

Artist outbox keys are deterministic per refund/purpose: `refund_confirmed_artist` and `refund_review_artist`. Duplicate events do not create duplicate financial or notification intent. No client refund mail is added, and no historical scan generates bulk mail. Notification failure cannot undo a ledger commit. Keep `NATORI_NOTIFICATION_SENDING_ENABLED=0` in isolated verification. There is no refund execution button or financial provider API call.

## Verification and remaining acceptance

The dedicated Phase 2D workflow extends the existing sealed Phase T/N/2A/2B/2C runner with 37 real-DB scenarios and five Chromium scenarios at 390px. After applying Phase 2D SQL it also reruns all 18 Phase 2B assertions, with the refund gate off. Only disposable fixture email suffix and evidence destination change; the original signed route, lease, replay, concurrency and process-kill assertions stay intact. Separate `phase2d-phase2b-compatibility.json` evidence retains the original pre-2D result file.

Payloads are synthetic and SDK-signed. Refund cases include full/multiple partial/duplicate refunds, reverse order with/without metadata, pending-to-success/failure, later failure, stale/same-second states, unknown original, other product/project, currency/amount/over-total mismatch, optional ID enrichment, identity conflicts, truncated charge lists, concurrency, lease/owner/anonymous boundaries, lost commit response, duplicate checkout identity conflicts, legacy source unknown, and DB/aggregate/CSV equality while business facts remain unchanged.

Preparation verification: 19 focused unit tests passed; source-only strict TypeScript, focused lint and integration bundle compile passed. Database SQL execution (37 scenarios) and five browser scenarios are authored but pending sealed CI. Full existing product suites and static migration manifest checks must run against the dependent PR head. Record the exact PR SHA/run/results before claiming phase acceptance.

Actual Stripe test-mode webhook delivery remains pending because a dedicated test credential profile is unconfigured. Synthetic signatures do not establish provider verification. Real mail and iPhone Safari acceptance are deferred until after Phase 7 with the user.

## Rollback

For a writer rollback set `NATORI_REFUND_LEDGER_ENABLED=0` and leave `NATORI_REFUND_LEDGER_READ_ENABLED=1`. Keep the additive migration and deployed reader so confirmed full/partial refunds, net amounts and CSV facts remain visible on active and completed owner projects. Already received retry/review inbox facts remain durable for later reconciliation. Disabling refund writes restores the frozen Phase 2B checkout request shape and completion v1; it does not undo provider refunds. Retain ledger facts, scoped original mapping, normalized inbox and outbox observations. Do not delete refund facts, replay historical mail, force-push, or alter original financial/business records.

## Original requirement traceability

Source: `Natori_Improvement_Plan_2026-09-26.md`, Phase 2D / F21, lines495–521; related original QA F21. Full reconstructed originals and Library provenance metadata remain in the authorized Work's `task/originals`. Exact original source file content was reviewed; archived customer records were not queried.

| Original acceptance | Implementation | Isolated verification |
| --- | --- | --- |
| Preserve original gross, received money and delivery/business state | scoped immutable transaction mapping and additive ledger; no refund execution endpoint | full-refund-preserves-original-money-business-and-delivery-facts; duplicate-checkout-conflicts-cannot-rewrite-original-mapping-or-refund-totals |
| Refund ID counted once; events can precede payment | scoped ledger identity, fenced inbox and later reconciliation | duplicate-event-and-new-event-same-refund-have-one-effect; refund-before-payment-is-visible-then-reconciles-once; metadata-free-refund-before-payment-keeps-unclassified-fact |
| Pending/failed/unmatched/currency/amount mismatch excluded | confirmed-status aggregates and visible review state | pending-to-failed-and-requires-action-never-count; currency-invalid-amount-and-over-total-are-quarantined; unknown-original-remains-unresolved-and-visible |
| Gross minus confirmed refund equals net; existing CSV columns retain meaning | additive result/CSV columns, blank unknown numeric cells | real-db-summary-results-csv-match-with-status-preserved; legacy-paid-original-with-unknown-scope-mode-retains-gross-and-unknown-net; browser partial/full/pending CSV checks |
| No inferred automatic close/reopen or customer mail | business fields preserved; deterministic artist-only outbox intent | full-refund facts; commit-response-loss-replay-keeps-one-ledger-one-notice; original post-migration Phase2B18-case gate |

Tests in this table are authored until exact dependent PR CI evidence is recorded. The original historical Stripe reconciliation dry-run/backfill/cutover and actual provider trials require a configured dedicated test profile and separately authorized release. No historical customer backfill or production data write is performed in this code phase. Unknown legacy refund history remains visibly unverified rather than silently zero.

Verified base: Draft PR104 head `649aaf1ad1b14c34842b44fbcc3ed41786ba19fc`, base2B `4d2e89aa2351b271997c747bbb552ab5078de947`. Base CI36940005545 passed2C DB35/browser9 and prior N/2A/2B/isolation; merge checkout97c4588 and head649aaf1 had identical Git trees. Phase2D remains unaccepted until its own isolated CI and independent reviews pass.

Quick manual check in an isolated owner fixture: open results, compare original gross/confirmed refund/net with CSV, then inspect a pending or unknown original. Confirm the project remains completed and refund/net unknown cells are blank. Actual customer mail and iPhone Safari checks remain the post-Phase7 user session.

## Independent review revisions and committed acceptance

Separate SQL and application reviewers identified and corrected same-second nonterminal/success ambiguity, project/payment lock inversion, frozen expanded legacy event replay, active-project refund visibility, read-only writer rollback, and schema-supported unknown-original net aggregation. The Natori-only account/mode advisory critical section is reentrant and precedes project/payment/refund locks; it trades low-volume financial write throughput for consistent PI/charge alias handling. Other products retain their existing dispatch.

The original normalized inbox request stays frozen on compatible optional-charge replay. Known charge conflicts or any changed original core field remain review-required. Positive confirmed refunds with unknown original gross are labelled confirmed with original unverified; neither full nor partial is guessed. Aggregate net remains unknown whenever an included original is unknown, matching row CSV blank cells.

Local reviewed application state passed full unit144 files/1293 tests before the final unknown-original addition; focused final tests and strict/lint/bundle checks are required below. No DB/provider/browser case is claimed passed before the dependent-head CI completes. Isolation executes all37 refund cases, all18 original2B cases after the2D migration, five real-owner-session Chromium cases, plus prior N/2A/2B/2C regressions. Read-only rollback is exercised against the real summary RPC. The active-card browser preserves production progress and controls under partial/full refund.

Draft PR base is codex/natori-phase-2c at649aaf1ad1b14c34842b44fbcc3ed41786ba19fc. Record head/run/results in the PR body and Work checkpoint; only accept this phase after actual isolated CI evidence and review fixes. Actual provider/history, real mail and iPhone acceptance remain separate gates.
