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
3. `fixture.sql` matches the previously read production delivery table constraints; only the
   Phase 1 migration is added. No full migration history or production seed is executed.
4. `integration.ts`: 28 real DB/Auth/Storage scenarios including absent/mismatched files,
   replay, delete/publish and accept/resend races, commit/response loss, legacy compatibility,
   ciphertext expiry, and an actual 200MiB signed TUS upload plus full download digest.
5. `browser.mjs`: 10 Chromium scenarios through actual management/customer routes, actual
   shared-key authentication, real file upload, missing-file CTA, receipt failures and recovery.

The local cloud Work has no Docker daemon. Safe local preflight:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
node scripts/natori-phase-1/build.mjs /tmp/natori-phase-1-integration.cjs
node --check scripts/natori-phase-1/browser.mjs
bash -n scripts/natori-phase-t/run.sh scripts/natori-phase-n/run-browser.sh
```

The runner's test-only Storage limit is 250MiB so the existing 200MiB product limit can be
exercised. **This is not evidence of the production global Storage limit.** Global and bucket
limits must be checked separately before activation. A mobile Chromium viewport is not an
iPhone Safari or home-screen-app test. Provider capture proves application ordering and
idempotency, not actual mailbox delivery. Artifacts contain counts, safe classifications,
versions, fixture-only screenshots and checksums, never passwords, signed URLs or mail bodies.
