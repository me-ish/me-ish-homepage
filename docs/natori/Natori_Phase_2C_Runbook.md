# Natori Phase 2C: generation, deadline and terminal guard

Stacked work in progress on Phase2B Draft PR103, head4d2e89aa2351b271997c747bbb552ab5078de947. Its exact-head CI36888523368/job110457927866 passed: unit1245/138, N DB23/browser9,2A DB14/browser6,2B DB18/failed0/skipped0 including actual synthetic worker SIGKILL recovery. Actual Stripe test-mode delivery/profile remains a separate unverified acceptance gate.

## Initial implementation boundary

paymentLinkLegacyPolicy.ts is a read-only pure reconciliation policy, with15 regression cases. It preserves the existing URL and the legacy latest successful same-URL mail deadline. It requires exact provider ID/URL/active evidence and an explicit payment reconciliation result. Missing/invalid deadline, unknown financial results, unresolved issuing, and projection/provider conflict are needs_review; no automatic repair, reissue or backfill. Provider-inactive links remain inactive. Closed/archived active links are stop_required rather than reopened. Received payment facts remain protected and require separate review.

This policy is not yet connected to a provider/DB dry-run runner or application cutover. It must not be described as completed Phase2C. No existing business rows, URLs or deadlines have been changed.

## Required next implementation

1. Expand-only generation attempt and operation tables, per-project accepted quote/generation, durable operation/hash, claim token/lease/fencing, explicit deadline/revision, frozen creation facts, known price/link IDs and provider mode/account.
2. Project-first claim/save RPCs, recover same attempt, stable price/link Stripe keys. External calls outside DB lock. After Stripe key retention window, unknown results require reconciliation from known IDs/metadata/transactions, never blind recreation.
3. Split initial issue, same-generation renotify, confirmed deadline extension and explicit reissue in server/API/UI. Persist encrypted notification intent separately from link validity. Only verified active saved link can be notified; resending never extends the deadline.
4. Fenced expiry claim binds generation/deadline revision. Extension cannot race a committed deactivation claim; stop/reissue outcomes remain visible. New and legacy cron must never both write during cutover.
5. Atomic close blocks new acceptance/issue, records external stop tasks, preserves money/delivery/acceptance. Archive rejects unresolved links; existing archived exceptions only read-only review. Delayed checkout money goes through2B without reopening or automatic refund.
6. Read-only legacy audit runner uses this policy; proven candidates preserve exact URL/deadline, unproven rows remain review. No automatic production backfill.
7. Real isolated DB two-worker tests and synthetic transport interruption tests, then separately authorized actual Stripe test objects create/stop and recovery. Existing prior quote/payment/browser suites remain mandatory.

Feature cutover stays OFF until integrated and verified. Phase4 is already deployed, do not redo. No merge/deploy/productionDB/env/customer/mail operations are authorized here. Actual-provider gap must not block independent3A/3B/5/6 work, but it prevents provider-complete acceptance claims for2B/2C/2D.

## Integrated implementation checkpoint (not acceptance-complete)

Official CLI created20261001161401_natori_payment_link_generations.sql. Expand-only attempts/operations/stops, owner-scoped service-only invoker RPC, project-first locking, token/generation/lease fencing, known Stripe IDs and23-hour unknown-result retention guard, explicit deadline/revision, close/late-create stop task, archive unresolved rejection, old projection writer rejection. No historical business data rewritten. Only explicit provider-verified legacy adoption preserves the same URL and old latest-successful-mail deadline.

paymentLinkService.ts validates strict operation schema and encrypted notification payload before external creation, freezes hash/keys, recovers same operation, checks original inactive link and Checkout payments, expires old open Checkout sessions before reissue, verifies active object/mode/quote/project/amount before notification. Provider calls never run in a DB transaction. notification intents are independent of link validity; mail gate verifies active generation/deadline with a short lease, while external stop waits for this lease. Extending a deadline does not send stale frozen deadline notifications. Unknown money/provider results remain review.

Management payment-link GET/POST uses existing actual authorization/CSRF boundary. UI loads availability before leaving the legacy path, separates issue/renotify/extend/reissue/adopt, restores frozen sessionStorage request, blocks editing during recovery, shows separate link and notice outcomes. Explicit deadline uses local device datetime; generated message has saved deadline rather than the legacy send-date-plus7 wording. Public quote view reports confirmed/active/creating/stopped/terminal facts. Featureflag NATORI_PAYMENT_LINK_INTEGRITY_ENABLED remains OFF by default; enabling also requires existing quote/payment integrity and outbox flags. Legacy mail/Cron payment writers are bypassed together. No production flag or runtime was changed.

NewCI NatoriPhase2C runs priorN/2A/2B before applying2C fixture and21 mandatory DB/synthetic-transport cases: creation atomics, concurrent issue, replay/conflict, price/link/committed-DB response loss, two-connection fencing, retention elapsed, renotify deadline, extension/stale notice, expiry-vs-extension, close-during-create, archive stop resolution, delayed money, provider-inactive no-mail, exact legacy adoption, compatibility-writer guard, mail-vs-stop lease, reissue/openCheckout expiry, paidCheckout block, owner/anon boundaries. These cases have not yet passed on an exact head. Actual Stripe provider objects remain separately unverified. New Phase2C browser recovery/CSRF/390px flow verification still pending; existing prior browser tests do not establish the new UI acceptance.

Latest local fullunit before the public-state follow-up1260/139 passed; type/lint/static26migrations/bundle checks passed. Must complete exact-head DB/CI and new UI/browser evidence before declaring Phase2C automated-complete. Continue2D and independently3A/B/5/6 with provider gates explicitly pending. Phase4 already deployed, no repetition.
