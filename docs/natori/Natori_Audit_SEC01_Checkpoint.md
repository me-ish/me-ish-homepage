# SEC01 and SEC01B incomplete checkpoint

This is an unfinished implementation saved for handoff at the user's request. It is not ready to merge or deploy. The branch is stacked on PR #162 at 0f059f6bd3bc33a63a32f3f524e42bf9749e29b5. PR #162 production application remains a separate approval.

## Saved scope

- Private management thumbnail writes and authenticated, target-owner image GETs. Legacy thumbnails have an authenticated read compatibility path; existing direct Storage URLs remain a migration/CDN gate. No existing gallery bucket is made private.
- A shared public projection for the public content API, portfolio/showcase/contact SSR and RSC, and OG. Hidden work/link/image/video fields and dependent artwork references are filtered. Full editor GET uses the management guard and no-store.
- New portfolio image and video assets stay private. Publication is checked on each media GET, including after upstream response headers. New image rendering bypasses the Next optimizer, and middleware rejects optimizer requests for managed media and OG. Previously returned bytes and external/social caches are not revocable.
- Draft image upload, signed private video upload plus verification, explicit publication defaults, metadata ownership checks, and streaming/range media GET.
- A CLI-generated forward migration creates a dedicated private bucket, metadata table and service-only grants, restrictive browser policies, revision column/trigger and compare-and-save RPC. No migration was applied outside the disposable fixture.
- Editor revisions reject stale/concurrent saves; changes made during a save are preserved.

The private-retention/public-gateway approach was chosen as the proposed default after reporting the tradeoff with the earlier public-copy idea. Confirm this architecture and its performance implications before completing acceptance. No explicit answer to the option question was received.

## Verification state

- TypeScript checks passed after the implementation changes checked so far. Repeat on the final handoff checkout.
- Related 117 unit tests passed; subsequent process-video/middleware checks passed 46 tests.
- One full unit run: 237/238 files passed, 2296/2298 tests passed. The two failures were expectations that omitted the new published:false upload state. Those expectations were updated and the affected suite passed; the full suite has not been rerun afterward.
- Baseline static check passed: 33 active, 55 archived; frozen pair bytes unchanged. This is not a claim that all 33 files replay successfully. The pre-existing migration 7 duplicate CHECK remains outside this task.
- Real isolated PostgreSQL 17.6, GoTrue 2.196.0, PostgREST 14.17, Storage API 1.74.0 and actual Next HTTP proved anonymous/unrelated-user editor denial, owned thumbnail access, foreign-project rejection, preserved legacy URL behavior, and upload-before-save denial at direct Storage and application URLs.
- The HTTP acceptance stopped at locale handling: Next redirected the 127.0.0.1 fixture host to localhost at the same local port. The harness's strict origin check rejects this alias; an earlier unbounded local redirect attempt hit redirect-count exceeded. Public HTML/RSC/OG, publication/unpublication, concurrency, video ranges, and injected save failure are coded in the harness but have NOT completed. Do not label them PASS.
- No final new-branch CI has been completed. Some workflow triggers require main or codex/natori-phase-* as the PR base; this stacked PR needs a reviewed CI trigger/workflow plan.

## Remaining work

1. Review and finish the implementation, error handling, URL canonicalization, upload-token scope and asset validation; format the compact new code.
2. Fix the isolated harness's loopback/locale handling while continuing to refuse any non-local redirect. Run its complete matrix, including cross-owner assets, private/delayed projects, storage/DB errors, read-state races, upload/save failure, same-file aliases and optimizer paths.
3. Validate real video upload/finalization/streaming/ranges, oversized/invalid input and immutable signed uploads. Verify the 50 MB contract without response buffering.
4. Add meaningful tests for direct helpers, editor conflict/in-flight edits, managed-image rendering and origin cache boundaries. Run full units, types and lint on the final code.
5. Update the exact accepted-reader guard in scripts/natori-phase-7/prepare-browser.mjs for the public/private reader split while preserving its workflow provenance checks; it still expects the prior loader block.
6. Add a dedicated isolation CI workflow covering the stacked PR, and collect sanitized source/result hashes. Runtime JSON and private logs contain generated fixture tokens and must not be committed.
7. Prepare a reviewed selective legacy thumbnail/draft inventory, copy/verification/rollback/retirement procedure. Do not bulk privatize natori-portfolio or automatically delete legacy shared artwork. Existing URLs, browser/CDN/social copies remain until explicitly handled; no claim of instant global revocation.
8. Specify the approved code/schema deployment window and rollback. Keep anonymous/private denial during failures; deploy and migration execution need separate authorization.

## Production and private evidence

No production Storage/DB/permissions change, customer-image move/delete, merge or deployment occurred. The separate authorized PR #162 catalog read used READ ONLY and no customer rows or secret values. Its evidence is kept in the private Work handoff, outside this branch. Automatic approval review rejected publishing those production catalog findings in GitHub; they are not part of this PR.

Useful Work-local files: /workspace/audit-handoff/db01-current-catalog-20261012.json, /workspace/audit-handoff/pr162-db01-exact-reviewed.sql, and /workspace/audit-handoff/pr162-certificate-view-restore-review-only.sql. The restore candidate is review-only, untested and unapplied. Next Work may need the parent to transfer these private files or repeat the authorized catalog query.

## Local continuation

Working directory: /workspace/sec01-implementation. Install locked dependencies with npm ci --ignore-scripts, then node scripts/natori-private-assets/run.mjs. Requirements include Docker, ffmpeg and a clean checkout without any root .env* files. The runner constructs fresh internal networks and label-owned services and cleans them up. Only generated fixture data is used. No production configuration is accepted.
