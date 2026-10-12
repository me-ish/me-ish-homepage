# SEC01 and SEC01B incomplete checkpoint

The former executor explicitly saved and stopped; the handoff gate is met. The continuation completed the source fixes and local verification below. Real isolated CI and production/device gates remain; this is not ready to merge or deploy until those acceptance gates are reviewed. The branch is stacked on PR #162 at 0f059f6bd3bc33a63a32f3f524e42bf9749e29b5. PR #162 production application remains a separate approval.

## Saved scope

- Private management thumbnail writes and authenticated, target-owner image GETs. Legacy thumbnails have an authenticated read compatibility path; existing direct Storage URLs remain a migration/CDN gate. No existing gallery bucket is made private.
- A shared public projection for the public content API, portfolio/showcase/contact SSR and RSC, and OG. Hidden work/link/image/video fields and dependent artwork references are filtered. Full editor GET uses the management guard and no-store.
- New portfolio image and video assets stay private. Publication is checked on each media GET, including after upstream response headers. New image rendering bypasses the Next optimizer, and middleware rejects optimizer requests for managed media and OG. Previously returned bytes and external/social caches are not revocable.
- Draft image upload, signed private video upload plus verification, explicit publication defaults, metadata ownership checks, and streaming/range media GET.
- A CLI-generated forward migration creates a dedicated private bucket, metadata table and service-only grants, restrictive browser policies, revision column/trigger and compare-and-save RPC. No migration was applied outside the disposable fixture.
- Editor revisions reject stale/concurrent saves; changes made during a save are preserved.

The user explicitly authorized completing the private-retention/public-gateway handoff. That architecture is the continuation default; the earlier unanswered optional architecture question is no longer a blocking approval. Production performance and the selective legacy URL/CDN retirement remain separate gates.

## Verification state

- TypeScript checks passed after the implementation changes checked so far. Repeat on the final handoff checkout.
- Related 117 unit tests passed; subsequent process-video/middleware checks passed 46 tests.
- One full unit run: 237/238 files passed, 2296/2298 tests passed. The two failures were expectations that omitted the new published:false upload state. Those expectations were updated and the affected suite passed; the full suite has not been rerun afterward.
- Baseline static check passed: 33 active, 55 archived; frozen pair bytes unchanged. This is not a claim that all 33 files replay successfully. The pre-existing migration 7 duplicate CHECK remains outside this task.
- Real isolated PostgreSQL 17.6, GoTrue 2.196.0, PostgREST 14.17, Storage API 1.74.0 and actual Next HTTP proved anonymous/unrelated-user editor denial, owned thumbnail access, foreign-project rejection, preserved legacy URL behavior, and upload-before-save denial at direct Storage and application URLs.
- The HTTP acceptance stopped at locale handling: Next redirected the 127.0.0.1 fixture host to localhost at the same local port. The harness's strict origin check rejects this alias; an earlier unbounded local redirect attempt hit redirect-count exceeded. Public HTML/RSC/OG, publication/unpublication, concurrency, video ranges, and injected save failure are coded in the harness but have NOT completed. Do not label them PASS.
- No final new-branch CI has been completed. Some workflow triggers require main or codex/natori-phase-* as the PR base; this stacked PR needs a reviewed CI trigger/workflow plan.

## Continuation implementation and local verification

- Preserved explicit private-video flags through editor normalization and explicit private-work flags through legacy collection normalization. Added complete save/read/public projection regressions.
- Closed local, absolute/protocol-relative, query, encoded, Storage render/public and Next slash identity aliases without treating a foreign origin as an ownership reference. Save rejects nonlocal reserved asset references; HTTP filenames are parsed without a second decode.
- Rechecked thumbnail target ownership after Storage; added reassignment/failure tests. Private portfolio metadata remains owner/path/kind/ready scoped.
- Video finalization now verifies Storage MIME/size/bucket/path metadata and only a bounded 24-byte MP4 header range. Media GET validates upstream MIME/size/range, cancels on a failed second publication read and ties download cancellation to request abort.
- Added a separate editor save-in-flight guard and tests for concurrent clicks, later edits, stale-revision conflicts and server failures. Managed image rendering and protected optimizer alias tests retain the ordinary gallery optimization regression.
- Preserved Phase7 workflow provenance hashes and exact suppression/read guards, extending only the accepted public/private reader split. Added exact stacked-base CI triggers and a dedicated native isolated HTTP workflow with sanitized nonempty source inventory, PR-head/tested-checkout provenance and digest-pinned internal services.
- The expanded isolated matrix uses genuine generated GoTrue anonymous/other-user sessions and anonymous signed-upload clients. It includes publication/ownership in-flight races, DB/Storage failures, token path/bucket/forged-upsert/TUS/replay attempts, 50 MB video streaming, invalid metadata/header/size/ranges, cross-owner assets and public gallery regression. This matrix is prepared for CI, not yet certified PASS in this checkpoint.
- Final local verification passed **242 files / 2,340 tests**, TypeScript (`tsc --noEmit --incremental false`), lint and five isolation helper/guard tests, including actual Phase7 guard acceptance and rejection of changed provenance. Lint reported only the existing AnnouncementCard image/alt warnings; existing jsdom navigation diagnostics appeared during passing unit tests. The React checklist covered hook cleanup, functional updates, transient save refs, authenticated data paths, safe image forwarding and existing alt text.
- Baseline static passed **0 failures**, **33 active / 55 archived**, frozen pair `d395d0735ab8e25826a2654f9d38f4c3e7688f08f47405e861ba6bd2956d980a`; existing frozen and archived bytes/guards were preserved. The SEC01 additive migration rejects existing bucket configuration drift and checks the postcondition; its own manifest hash is updated. This does not certify full active replay.

Critical reviewed source SHA-256:

- `portfolioAssetsService.ts`: `76fde76f7252ce4fc1f1555869c4e38e72ada9d2bb505ff867fb9c2f73fc0f0e`
- `portfolioAssetUrl.ts`: `5e969ea368a28b2040b62d96e806a7df94d81e8cb9d7107cfa01975a1fce3ec3`
- `middleware.ts`: `39cb9e4ae2f80650407fef11473ae7d06840dc8acb4f7f8e48edb25187634bbd`
- SEC01 migration: `1cb8e032751a3b95c10bde4bec5bc3aae55e5e115681cf5a220d84f7dbc040a9`

The independent static review found no remaining product-source blocker after the alias/filename/middleware corrections; its reviewed 30-file product fingerprint is `62f4df929d160ace16f26d63fa567ac56de5e07b22e7c5853853c24d98ee9371`. Native Storage/TUS/HTTP behavior remains subject to exact-commit CI. The final harness additionally checks hidden-only OG byte invariance, TUS wrong-path/bucket and fresh forged-upsert confinement; command diagnostics omit token-bearing argv/stdout/stderr and expose only safe operation/status/code fields.

## Remaining acceptance gates

1. Exact-head independent auth/database/security review and real native isolation CI artifacts must pass; this local runtime has no Docker executable, so no completed local native matrix is claimed.
2. Preserve anonymous/private denial through the separately approved production schema/code window and rollback described in [the deployment runbook](Natori_Audit_SEC01_Deployment_Runbook.md). No production schema, Storage, ACL, data move/delete, merge or deployment is authorized by this branch.
3. Produce and approve the private, selective legacy management/draft inventory before copy/reference cutover/retirement. Shared gallery objects and old public URLs/CDN/browser/social copies remain explicit residuals.
4. Verify real iPhone playback and representative origin performance before their acceptance is claimed.

## Production and private evidence

No production Storage/DB/permissions change, customer-image move/delete, merge or deployment occurred. The separate authorized PR #162 catalog read used READ ONLY and no customer rows or secret values. Its evidence is kept in the private Work handoff, outside this branch. Automatic approval review rejected publishing those production catalog findings in GitHub; they are not part of this PR.

Useful Work-local files: /workspace/audit-handoff/db01-current-catalog-20261012.json, /workspace/audit-handoff/pr162-db01-exact-reviewed.sql, and /workspace/audit-handoff/pr162-certificate-view-restore-review-only.sql. The restore candidate is review-only, untested and unapplied. Next Work may need the parent to transfer these private files or repeat the authorized catalog query.

## Local continuation

Use a clean checkout of the exact reviewed PR head. Install locked dependencies with npm ci --ignore-scripts, then node scripts/natori-private-assets/run.mjs. Requirements include Docker, ffmpeg and a clean checkout without any root .env* files. The runner constructs fresh internal networks and label-owned services and cleans them up. Only generated fixture data is used. No production configuration is accepted.
