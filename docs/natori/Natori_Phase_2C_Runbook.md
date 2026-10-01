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
