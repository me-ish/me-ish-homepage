# Natori Phase 2A — verification gate

Originals: Improvement Plan / QA / UX 2026-09-26 (991f5ae audit baseline). Implementation baseline: main 9b1b84561d0f6dc2ef18816ba530488c499ade39. Phase 4 is already production and is not reimplemented.

| Item | Implementation | Required evidence |
| --- | --- | --- |
| F05 | Lifecycle before mail; current-status/quote/payment CAS for compatibility updates | Acceptance/payment/progress during mail |
| F09/F22 | Quote, snapshot, active project and notification intent in one transaction; durable operation replay | Response loss, concurrent issue, revision conflict, reload |
| F10 acceptance portion | Project-first lock and closed/archive/latest quote guard | Closed/archive rejection, close-v-accept |
| U16 | Main estimate journey and version-specific notification; old entry is notification-only adapter | Old quote/URL compatibility |
| U17 | Persisted mail draft, preserved custom body, explicit replacement candidate | Edit/back/reload |
| U05/U21 acceptance portion | Formal version and separate acceptance/notification results | Quote and browser regression |

F10 still requires Phase 2C external link shutdown and delayed payment handling. U05/U21 have later cross-phase work; this PR does not mark those whole items complete.

## Existing data and staged rollout

Expand only: no historical project/quote/acceptance/payment/customer-answer/file rows are repaired, deleted or rewritten. Existing quote hashes remain valid. Re-notification adds a hashed access to the SAME immutable quote; plaintext capability links only enter encrypted notification payloads. Existing active quotes without operation records return `legacy_unknown`, never inferred mail success.

Apply the reviewed migration first, verify definitions/grants/RLS/indexes and historical fingerprints in the approved target, then deploy compatibility code with NATORI_QUOTE_INTEGRITY_ENABLED=0. Enable the new writer only after evidence and production approval. Requires existing Phase N configuration and Phase 1 notification encryption key; no secret inspection or key change.

Production Phase 1 history is 20261001125429 natori_delivery_integrity, corresponding to source 20260930101753_natori_delivery_integrity.sql. Preserve that mapping; do not replay the old source merely because history timestamps differ.

This development PR authorizes no production schema/environment/deployment/email changes and uses no real customer fixtures.

## Recovery / rollback floor

Keep expanded tables and safe acceptance/draft guards. Preserve additional-access readers. After new operations exist, rollback only to a compatible application retaining the new writer/outbox contract; do not restore the independent legacy writer, delete operations or reinterpret unknown mail as failed. Unknown results recover the same payload/provider key within the existing bounded window; expired unknown results require provider reconciliation, never another automatic mail or quote.

Old REST draft writers may lose a deadlock race to the project-first issuer and must reload; invalid writes never commit. New saving uses the project-first RPC. Explicit re-notification after confirmed sent/definite failed mail is a new confirmed notification operation without a new quote version.

## Tests and pending gates

Local typecheck/lint/static migration checksum/service and component regression/bundling. The PC lacks Docker; real DB verification is provided by the new Natori Phase 2A workflow using the reviewed Phase T disposable Linux stack. Prior Phase N runs first, then reviewed quote migrations, real DB/Auth races and Chromium tests. Network isolation, ephemeral credentials and synthetic provider capture prevent production and real mail access. Evidence excludes raw bodies/tokens/addresses/credentials.

Manual email and iPhone are deferred to final acceptance. Chromium mobile viewport is not iPhone Safari. CI results must be recorded before Phase 2A is declared complete.

Remaining dependency sequence: 2B Natori-only Stripe inbox/lease/fencing; 2C payment-link generations/deadlines/terminal handling; 2D refund ledger and gross/refunded/net/CSV; 3A intake idempotency; 3B atomic consultation with local attachment draft; 5 canonical confirmation/integer/step validation; 6A locked latest-task aggregation; 6B public wording/contrast/full short answers/HERO pause; 7 U20–U23 adoption/retain/decision record. Stripe test mode evidence is mandatory for 2B–2D. U20/U22/U23 remain Deferred for reassessment; no automatic decoration removal or works-page sales CTA.
