# Integration acceptance for PRs 162–166

This is the local integration record for the approved DB01, SEC01, PAY01,
PAY03 and WF01 source changes. It authorizes no production operation and does
not replace their individual deployment runbooks or the combined hosted gate.

## Exact inputs

Remote `main` was freshly fetched at
`9abcd1310aba049d512221c2786119af06b12e35`. The isolated branch is
`codex/audit-integration-162-166`. The original audit worktrees were clean and
were not modified.

| Order | PR | Verified remote head |
| --- | --- | --- |
| 1 | 162 / DB01 | `0f059f6bd3bc33a63a32f3f524e42bf9749e29b5` |
| 2 | 163 / SEC01, stacked on 162 | `bd7e4bdc405a6f09c1b058fee7e60407914f160a` |
| 3 | 164 / PAY01 | `39a62a76d037409081a7a26f65f01118f443951b` |
| 4 | 165 / PAY03 | `a4a2f3a560962d146964b1efa618598825c688fe` |
| 5 | 166 / WF01 | `986a89d2447c57146044fb13303623e3a47c8980` |

Each exact remote head is an ancestor of the integration branch. Local merges
preserve the remote histories in this order. Before adding this record, 204
files differed from the starting main; 199 matched their latest approved PR
blob exactly. The remaining five files contain the additive resolutions below.

## Conflict and overlap resolutions

| File | Resolution |
| --- | --- |
| `supabase/baseline/manifest.json` | Union the DB01, SEC01, PAY01 and WF01 active migrations, required sequence, object inventory and existing SHA-256 pins. Set the active count to 35. Preserve the archived count of 55 and every existing checksum. No migration SQL changed. |
| `scripts/natori-phase-3a/browser.mjs` | Retain DB01's fixed-code `compileErrorCodes`, `expectedTestCount: 9` and bounded filesystem-error console classification. Retain WF01's mapped `compileErrors`, bounded sanitized observations, final-guard booleans and terminal failure persistence. Both approved sets of diagnostics remain available. |
| `scripts/natori-phase-6b/prepare-browser.mjs` | Retain both PAY03's payment types and WF01's consultation types in the actual rendered-source checksum inventory. All copied bytes still come from current source. |
| `src/types/supabase.ts` | Automatic additive merge retains the SEC01 private-asset RPC types and WF01 rough OK/acknowledgement/list/retry/overview RPC types. |
| `src/features/natori/server/__tests__/projectsService.test.ts` | Automatic additive merge retains PAY01 delivery-boundary assertions and WF01 mandatory overview-v2 mock/read cases. |

There was no product implementation conflict or SQL conflict. The original
four Phase3A substring detectors and exact final assertion remain unchanged:
exactly nine passed cases and an empty compile-error Set are required. No
source inventory entry, assertion, schema prerequisite or isolation gate was
removed. Astra independently confirmed the diagnostic union and unchanged
four migration hashes.

## Local verification

| Check | Result |
| --- | --- |
| Full Vitest suite | 254 files, 2,647 tests passed |
| Strict TypeScript | Passed |
| Full `next lint` | Passed; existing `AnnouncementCard.tsx` image/alt warnings remain |
| Migration static inventory | Passed: 35 active, 55 archived; frozen baseline pair unchanged |
| Phase6A exact-source prerequisite | Passed without changing a source pin |
| WF01 reader fixture, SEC01 isolation, DB01 environment-guard tests | 17 tests passed |
| Phase0B → Phase4 → Phase6B → Phase7 disposable source snapshot | Passed; 417 copied/generated file hashes verified, including both payment and consultation types and combined services |
| Native runner shell/Python and merged harness syntax | Passed |
| Whitespace/conflict-marker checks | Passed |

Local Docker/PostgreSQL and Playwright Chromium are unavailable. The dedicated
native runners require an isolated GitHub-hosted Linux runner; those conditions
were not spoofed. No browser/Storage/native SQL execution is claimed by this
local record. No production configuration, database, Auth, Storage, provider
send or credential was used.

## Runner pins and scope

PAY01's MD5 checks bind the predecessor delivery RPC SQL bodies and runtime
settings. They do not bind or execute `projectsService.ts`. The dedicated
PAY01 and WF01 native suites execute their exact named historical prerequisites
and their own forward SQL. They do not execute TypeScript services, all four
forward migrations together, or the full active migration directory.

PAY01's separate product regression job executes current-source unit tests and
types. Phase4/6B/7 and private-asset fixtures copy current combined sources.
The Phase6A SHA-256 pin for `projectsService.ts` already matches the approved
PAY01 implementation, which WF01 does not modify. WF01's existing notification
lifecycle MD5 checks remain unchanged. No pin refresh is needed for this tree.

Require fresh hosted native, private-asset Storage/HTTP and browser evidence
against the final combined tree before the held rollout. Keep the independent
schema prerequisite checks and the individual deployment order/holds; a green
source job alone is not combined production-state proof. The known unrelated
full-active-replay limitation is not repaired or suppressed here.

## Sequential PR prefix plan

1. Merge verified PR162 first. Retarget the stacked PR163 to main only after
   its DB01 ancestor is present; then retain its verified SEC01 delta.
2. Update PR164 from the resulting DB01+SEC01 main. Its routine conflict is
   the manifest: keep DB01, SEC01 and PAY01 together (34 active migrations),
   with all three original raw SQL hashes. Do not include WF01 prematurely.
   PAY01 source and its matching Phase6A source pin remain intact. Recheck
   the exact updated PR head before merging.
3. Merge PAY03 against that prefix. Its actual-source payment-type checksum
   entry must remain present. No conflict was observed at this integration
   stage.
4. Update PR166 from the DB01+SEC01+PAY01+PAY03 main. Use the five-file union
   described above: manifest count 35, both Phase3A diagnostic contracts,
   both Phase6B type inventory entries, and additive generated types/test
   cases. Preserve every WF01 gate, current-source hash and raw SQL pin.
   Recheck the exact updated head and tree before merging.
5. Compare final main with the independently reviewed combined product/schema
   state and its hosted evidence before entering the maintenance window.
   Remote branch updates, PR merges and production operations belong to the
   release owner; this integration worktree performs none of them.
