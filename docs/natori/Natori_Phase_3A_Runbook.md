# Natori Phase 3A — intake operation integrity

Original scope: `Natori_Improvement_Plan_2026-09-26.md` Phase3A lines523–553, F02/F23/U18 and the related QA/UX requirements. Original reconstructed documents and Library provenance are retained in this authorized Work; they are not authenticated materialized-byte evidence. Phase1/4 production code is not reimplemented.

Dependency: DraftPR105, `codex/natori-phase-2d`, exact base `8607698c15dae9dd6cb6f2b90fed7a27d03392d5`, accepted isolated run `36953535426`. This is an additive code/test Draft change. No production rollout, database update, old-customer consolidation, actual mail or provider action is included.

## Resulting behavior

The structured and legacy forms create one browser operationID and canonical request/attachment hash for a send operation. Retries and uncertain responses keep that ID and frozen answers. Reusing the ID with different content is refused; a separately initiated legitimate request can use a new ID. Completed replay returns a minimal receipt, not another project or another notice. Reload recovers the same operation and visible saved answers. Original File objects cannot be restored automatically; matching files in the original order are reselected and byte-digests verified before retry.

The fixed owner, immutable manifest/projectID, admission, lease/claim, atomic original answers/references/project/receipt and two distinct PhaseN artist/client notice intents share the same guarded operation. A new undecided intake creates zero task rows until the owner confirms a concrete type. DB commit success survives notification failure; mail success cannot turn a failed save into an accepted request. Replay does not repeatedly consume the new-intake quota, while reconciliation retains a separate abuse bound.

No-ID old callers receive update/copy/check guidance before business/Storage/mail effects. The new UI does not automatically reload and discard input. Existing projects, quote/delivery/access tokens, payment history and customer mail records remain intact. No guessed operationIDs are assigned to historical requests and no old duplicate is removed by matching text/email.

## Independent corrections included

- Fresh clock checks follow late project/reference, notification and receipt writes. Expired claims raise40001 and atomically roll back every business effect. Operation observation/recovery retains the original frozen envelope; unknown outcomes never create a replacement ID automatically.
- Every operation prefix is excluded from broad orphan deletion. Only authoritative failed operations are considered by the exact cleanup RPC, intersected with bounded already-aged candidates and a linked-reference recheck. Late upload/remove-error can be retried on later scans. Processing/review/completed paths and durable failure tombstones remain protected; age does not imply failure.
- Client recovery ignores an observation unless both current operationID and hash match. Delayed failed/processing/completed responses for A cannot clear B's storage, alter B's notice/busy state or call B's receipt callback. Identical-content/different-ID cases are covered.

- Mounted lifecycle/job ownership is captured across each async boundary. An unmounted or disabled old job cannot clear a newly mounted form's storage, overwrite its record after hashing, start a replacement send, call its old receipt callback, or reset the newer job's busy/notice state. Current stored operationID/hash is checked before applying a result, and pre-send hashing yields to an existing recovery record. Five new actual-hook deferred regressions cover unmount, pre-send hashing, receipt callbacks, another stored owner, and disable/re-enable; all five earlier stale/current-result controls remain intact.

## Original acceptance traceability

| Requirement | Implementation / verification |
|---|---|
| One project/original-answer/reference/notice pair per operation | intake operation SQL/service; actual concurrent/replay/hash-change/commit-loss DB cases |
| Fixed owner and common structured/legacy save rules | canonical adapters/shared service; legacy lossless answer/label and boundary cases |
| DB success separate from mail delivery | atomic two-notice intents; interrupted/throwing notification/replay regressions, sending disabled |
| Recover uncertain result after reload without resubmission | persisted immutable envelope/client hook/recovery panel; real browser lost-ACK/restored-answer/attachment cases |
| Preserve existing customers and reject unsafe old writers | no-ID side-effect denial and copy/check guidance; owner/anonymous/CSRF/origin gates; no historical bulk operation |
| Final lease fence and exact temporary-file retention | four real two-connection late-lock probes plus interrupted/late Storage and cleanup-retry cases |

## Verification at this Draft head

Local combined checks: strict TypeScript; scoped lint (33 original changed paths and both final hook/regression paths); full154files1330unit tests with zero failures/skips; active baseline28/archived55; integration/claim-worker/browser-helper bundles; exact fixture generation; four Node/two Bash syntax checks; canonical SQL and whitespace checks, all passed. These are local code checks; actual isolated runtime remains pending..

Authored runtime gate: **26 real ephemeral DB/Storage cases and six real Next/Chromium browser cases**, plus prior N23/9,2A14/6,2B18,2C35/9,2D41/5 and post2D compatibility18, isolation17. The runner retains original assertions, private historical preseed, former-SQLSTATE proof, bounded diagnostics and sealed provider/public egress. Install3A fixture only after earlier payment/refund gates so later purpose CHECK migrations cannot remove intake purposes. Current runtime status: **pending exact committed-head CI**.

Canonical migration `20261001222233_natori_intake_operations.sql` single-LF SHA256 **b933138814adbd86f8e9fb9658a76e3de3dab808d07f5dfa96432c6fa6189d14**. Independent variable-name audit found no concrete ambiguity in all ten intake functions/baseline fixture helpers. Full runtime verification still determines acceptance.

## Deployment order, rollback and next work

Expand the additive operation schema before deploying the new orphan scanner/operation service. `NATORI_PUBLIC_INTAKE_V2` keeps its existing explicit structured/legacy UI rollout meaning; changing that selector does not restore an unsafe independent no-ID writer. Normal admission retains the published global default; mass-production intake requires explicit saved true. Actual production published settings/old-payload-version usage were not read or altered. The eventual authorized cutover must record non-PII compatibility usage/window and preserve copy/check guidance.

Retain operations, manifests, receipts and completed replay during a rollback. Pause new admission if needed while keeping result reconciliation. Do not delete operation evidence, restore unsafe old no-ID writes or regenerate historic tokens/mail. Temporary-file recovery uses exact reviewed evidence, not broad deletion.

Quick isolated manual check: submit once, interrupt/reload before the response, recover the same receipt/answers, reselect identical original attachments and retry the same operation; confirm one project and two notice intents. Test changed bytes/hash refusal and a definitive failed operation returning to edit. No actual mail is sent by that check. Real iPhone/mail acceptance is the user's requested postPhase7 session; actual Stripe profile remains a separate unconfigured/unverified gate.

Next phase after accepted3A: integrate reviewed3B local consultation drafts and atomic message/files/notice finalization, then5/6A/6B/7 with dependent DraftPRs and isolated acceptance. This runbook does not declare those prepared phases complete.
