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

- Completed A remains reload-recoverable until the user explicitly starts a new request. The action rechecks the exact capability and completed receipt, stores minimal receipt/email history before releasing the matching active record, and remounts the top-level form session. Both form variants reset controlled values and File objects. Unknown results, storage failures, changed identity/hash and unmounted manual actions retain the active record. Validated history is passed directly after retirement rather than reread after clearing.
- Every frozen answer set is preserved separately before an authoritative failed operation is released. Versioned backup storage retains multiple unacknowledged originals. A readable Japanese view and optional exact raw-copy fallback survive unsupported/partial restoration, both selector directions and subsequent reloads. Only explicit acknowledgement removes a failed original. Repaired backup storage clears its blocked flag only after successful preservation and current failed settlement. Nine actual-form regressions and two independently supplied blocked-storage controls pass alongside ten unchanged stale/remount controls and48 existing structured-form cases.

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

The first run, CI36956053107 at head8c0b8979c8e60e2642f898d1e383f201176f1fcd, passed all26 ephemeral DB/Storage cases and every previous report with zero failures/skips. It failed before the first browser case: the standalone helper could not resolve sharp. This failed run and artifact11206490420 remain preserved; it is partial evidence, not Phase3A acceptance.

The browser helper now resolves only its sharp import to the existing pinned /app/node_modules/sharp. Actual standalone helper import/call and bundle checks pass locally. The original six browser assertions are retained, with accessible selectors corrected to the actual UI. Three additive real-user flows cover explicit completedA-to-newB and both legacy/structured interrupted-before-begin selector switches. Every added scenario uses a fresh bounded Next process with the original auth/owner/flags and unmodified3-new/60-capability-per10-minute quota. A and B deliberately share one process/context. Exit and ECONNREFUSED prove that the old process cannot keep serving its port.

Local final graph: strict TypeScript; scoped lint for all changed product, regression and browser paths; full157files1344unit tests with zero failures/skips; active baseline28/archived55; integration/claim-worker/browser-helper bundles; five Node/two Bash syntax checks; canonical SQL and whitespace, all passed. The existing reload regression now explicitly waits for the actual multipart send before reading its payload; its acceptance/reconcile/receipt predicates are unchanged. The first full-run race failure is preserved separately. Actual failed-backup repair, both form continuations and ten stale/remount protections are included.

Second CI36960235624 at393dd4f63b923a984fb6a437fdc3bf26f59bd7d1 again passed all26 DB/Storage and prior reports. Browser5/9 passed, including explicit completedA-to-newB; interrupted/reselection and both selector-switch cases failed. Artifact11207593955 remains preserved. Thirty-one actual committed browser product-source digests match and tested merge6d848694fb2e79f32e81be493a600dd99525394a shares head tree09fde5511f220d519f3c16fd9505513d37f6f727. This is verified partial evidence, not acceptance.

The saved-original textarea formerly lived inside its own label. Actual React-rendered local HTML in a fresh network-blocked Edge context reproduced allfour relevant native-locator failures: name/email matched twice and exact saved-answer label matched zero. The label and readonly content are now separate, linked by a stable unique useId/operationID target. Original name/email/message locators, readonly data, raw fields and allnine browser assertions are unchanged. The same four Edge probes pass after the change, and three regression cases preserve native association, multiple mounted originals and full readonly fields. This local HTML proof does not replace the full Next/DB/Storage nine-case gate.

Browser failure diagnostics now retain only fixed scenario names, finite assertion-code allowlists and fixed failure-kind/locator enums. Arbitrary exception text, DOM, input values, headers, URLs and tokens never enter those diagnostic fields. Four constructed exceptions using the real failed identities, ten privacy controls and one success control passed; these were constructed tests, not recovered actual error traces. An additional full-unit timing failure showed pending controls before digest/send completion; five existing expected-unknown test fixtures now wait for the actual multipart send and recovery control to become enabled before inspection/actions/unmount. Each test resets its own mock queue. All48 tests and their original assertion predicates remain.

Mandatory final runtime gate: **26 real ephemeral DB/Storage cases and nine real Next/Chromium browser cases**, plus prior N23/9,2A14/6,2B18,2C35/9,2D41/5 and post2D compatibility18, isolation17, current/candidate35 each. The runner retains original assertions, private historical preseed, former-SQLSTATE proof, bounded diagnostics and sealed provider/public egress. Install3A fixture only after earlier payment/refund gates. Final committed-head runtime acceptance is pending; authored cases and local checks do not prove it.

Canonical migration 20261001222233_natori_intake_operations.sql single-LF SHA256 **b933138814adbd86f8e9fb9658a76e3de3dab808d07f5dfa96432c6fa6189d14**, Gitblob d327d1cc60ec2a26d954ad6bdae07328c2364555. Independent variable-name audit found no concrete ambiguity in all ten intake functions/baseline fixture helpers; the failed first run nevertheless executed all26 DB cases successfully.

## Deployment order, rollback and next work

Expand the additive operation schema before deploying the new orphan scanner/operation service. `NATORI_PUBLIC_INTAKE_V2` keeps its existing explicit structured/legacy UI rollout meaning; changing that selector does not restore an unsafe independent no-ID writer. Normal admission retains the published global default; mass-production intake requires explicit saved true. Actual production published settings/old-payload-version usage were not read or altered. The eventual authorized cutover must record non-PII compatibility usage/window and preserve copy/check guidance.

Retain operations, manifests, receipts and completed replay during a rollback. Pause new admission if needed while keeping result reconciliation. Do not delete operation evidence, restore unsafe old no-ID writes or regenerate historic tokens/mail. Temporary-file recovery uses exact reviewed evidence, not broad deletion.

Quick isolated manual check: submit once, interrupt/reload before the response, recover the same receipt/answers, reselect identical original attachments and retry the same operation; confirm one project and two notice intents. Test changed bytes/hash refusal and a definitive failed operation returning to edit. No actual mail is sent by that check. Real iPhone/mail acceptance is the user's requested postPhase7 session; actual Stripe profile remains a separate unconfigured/unverified gate.

Next phase after accepted3A: integrate reviewed3B local consultation drafts and atomic message/files/notice finalization, then5/6A/6B/7 with dependent DraftPRs and isolated acceptance. This runbook does not declare those prepared phases complete.
