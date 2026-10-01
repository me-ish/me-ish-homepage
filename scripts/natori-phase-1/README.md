# Phase 1: isolated delivery verification

The authoritative scope and rollout gates are in `docs/natori/Natori_Phase_1_Result.md`.

Run through the **Natori Phase 1** pull-request workflow. Push a normal commit to the existing
PR branch to repeat it; do not merge solely to execute tests. The workflow needs no production
secrets. The repository `.node-version`, locked dependencies, Supabase CLI 2.118.0 (SHA-256
verified), and Playwright 1.58.2 image are used. Image digests and resolved versions are artifacts.

The shared Phase T runner separates construction from execution, moves DB/Auth/Storage to an
internal-only Docker network, and applies kernel IPv4/IPv6 egress rules to every test/browser
child. Only disposable Kong:8000 and same-namespace Next:3000/mail capture:3101 are reachable.
An application destination guard additionally rejects production-looking URLs before fetch.
No Docker socket, production `.env`, linked project, external tunnel, live Stripe or email
provider is mounted. Cleanup targets only this run's labelled resources. The job has a 30 minute
limit, PR concurrency 1, and finite step/startup/transport retries. A failure is never skipped.

Order:

1. Existing Phase T: isolation and real Storage current/candidate policy assertions.
2. Existing Phase N: minimal reviewed fixture, DB/notification scenarios and 9 browser scenarios,
   with Phase 1 disabled. These regression scenarios keep their original assertions.
3. Phase 1 construction replaces only its labelled disposable Storage container with the same
   image, auth settings and named volume, an explicit internal `STORAGE_PUBLIC_URL`, local
   HTTP mode, and 50MB (50,000,000 bytes) size caps. The pinned CLI otherwise returns an upstream TUS host
   after the sealed network move. No client URL rewriting or broader egress rule is used.
   `fixture.sql` matches the previously read production delivery table constraints; only the
   Phase 1 migration is added. No full migration history or production seed is executed.
   The disposable browser shell uses system fonts: `prepare-browser.mjs` replaces only the
   reviewed Google Fonts `@import` in its copied `globals.css`. All application CSS rules,
   management/customer components, refreshes and API calls remain intact. Original and fixture
   CSS checksums are recorded separately. The browser gate still rejects every page/DOM error
   and resource rejection, and now also requires successful local stylesheet responses.
   No external font response is mocked and no network allowlist is widened.
4. `integration.ts`: 28 real DB/Auth/Storage scenarios including absent/mismatched files,
   replay, delete/publish and accept/resend races, commit/response loss, legacy compatibility,
   ciphertext expiry, and an actual 50MB (50,000,000 bytes) signed TUS upload plus full download digest.
5. `browser.mjs`: 11 Chromium scenarios through actual management/customer routes, actual
   shared-key authentication, real small/signed-TUS file uploads, missing-file CTA, receipt
   failures and recovery.

The local cloud Work has no Docker daemon. Safe local preflight:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
node scripts/natori-phase-1/build.mjs /tmp/natori-phase-1-integration.cjs
node --check scripts/natori-phase-1/browser.mjs
bash -n scripts/natori-phase-t/run.sh scripts/natori-phase-n/run-browser.sh
```

The fixture-only delivery bucket and disposable Storage caps are exactly 50,000,000 bytes,
matching the conservative decimal 50MB application limit. The test requires a successful boundary upload;
50,000,001 bytes must be rejected by the application and the direct reservation RPC.
Both legacy and current size environment keys are set explicitly
because the pinned image prioritizes `UPLOAD_FILE_SIZE_LIMIT` over the CLI's legacy setting.
Non-secret effective settings are recorded in `versions.txt`.
**This is not evidence of the production global Storage limit.** Global and bucket
limits must be checked separately before activation. A mobile Chromium viewport is not an
iPhone Safari or home-screen-app test. Provider capture proves application ordering and
idempotency, not actual mailbox delivery. Artifacts contain counts, safe classifications,
versions, fixture-only screenshots and checksums, never passwords, signed URLs or mail bodies.

## PR #101 failure investigation (2026-10-01 JST)

Baseline head: `67cc3d91ca3916445d9963fbd164c59a258b40fa`.

- **CI / Security Audit:** the unchanged main lockfile contained dev-only `brace-expansion`
  1.1.18, 2.1.4 and 5.0.9. Update only these three resolved packages to 1.1.21, 2.1.7 and
  5.0.12 with `npm update brace-expansion --package-lock-only --ignore-scripts --no-audit --no-fund`.
  Keep the high-severity gate. Run the full **CI**, including lint/type/unit/E2E coverage for
  the changed toolchain dependency graph. Do not use a broad `npm audit fix --force`.
- **Phase 0A:** before=26/26, after=25/26. Natural concurrent finish sample 20 recorded
  published download HTTP 500 / `InternalError`; the unchanged gallery adapter returned 503.
  Re-run the same head once in a fresh isolated stack; attempt 2 passed before/after 26/26,
  including all 24 natural and 12 synchronized pairs in each mode. Keep the original failure
  evidence and strict assertions. No product retry or Storage-policy change is justified here.
- **Phase 1 browser:** real DB/Storage 28/28, browser operation scenarios 10/10; the final
  page-error gate failed. The original shared stylesheet still imported external Google Fonts
  inside a sealed network. Diagnostic head `865aff1992f5c8f631350f497889c2f12315c760` preserves
  every rejection across navigation and records local stylesheet status without URLs/tokens.
  Fix the disposable CSS import, then repeat **Natori Phase 1** in full: existing T/N regressions,
  real Storage/TUS 28 scenarios, and all 11 browser scenarios. A filtered error, skipped test or
  relaxed egress rule is not a pass. Production font availability is outside this fixture test.

Minimal order: unchanged-head **0A** retry and evidence capture → scoped lockfile patch/full
**CI** → diagnose and remove the fixture's remote font import → full **Phase 1** → inspect
**T/0A/0B/N/4** on the final implementation head because the lockfile/shared runner is used
by those workflows too. Push to `codex/natori-phase-1`; keep the PR Draft and never merge to
trigger a test. Exact final head, run links and results are maintained in the
[PR #101 description](https://github.com/me-ish/me-ish-homepage/pull/101).

## Local Free-plan alignment (2026-10-01)

The production Settings screenshot confirms a Free-plan fixed 50 MB global cap, with no
bucket override. Supabase's [Limits documentation](https://supabase.com/docs/guides/storage/uploads/file-limits)
uses MB without specifying the production byte value. The application conservatively uses
50,000,000 bytes (decimal 50MB), not 50MiB (52,428,800 bytes). No cloud setting change is required.

Local verification: 45 tests passed across browser upload/API/server/receipt/encryption/schema
regression suites; typecheck, changed-file lint, baseline static check, integration bundle and
runner/configuration syntax passed. Browser upload and service boundary tests use mocks.
The updated real DB/Auth/Storage and Chromium workflows have not run for these local changes.
The prior PR head's 200MiB pass remains historical evidence, not a pass for the changed 50MB limit.
