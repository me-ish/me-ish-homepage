# PR #162 reproducible isolated acceptance

Run from a checked-out repository with the lockfile dependencies installed:

```bash
npm ci
node scripts/legacy-entry-read-security/acceptance/run.mjs
```

Requirements: Linux, Node from `.node-version` (the initial local runs used 24.19.0), Docker, curl, dpkg-deb, free loopback ports, and internet access for the digest-pinned official images/package during construction. The runner chooses fresh container/network names, ephemeral loopback ports and a private `/tmp/pr162-acceptance-*` result directory. It rejects inherited DB/Supabase/Stripe/Resend configuration by name and supplies generated local-only Auth sessions. The fixed passwords/signing/header strings are synthetic fixtures, not production secrets.

The runtime Docker network is internal; no DB or Auth port is published. The host's loopback-only gateway reaches only the dedicated container IPs. GoTrue SMTP points at an unreachable local port. Child processes receive a minimal environment. The runner verifies ownership labels before removing its containers/network. It never reads `.env`, connects to an existing project, changes cloud permissions, sends customer email, or uses customer rows. Failed runs retain private logs but still remove dedicated services.

## Assertions and provenance

- `api.mjs`: real GoTrue password sessions, unconfirmed email rejection, anonymous REST/pg_graphql exposure before lockdown and denial afterwards, linked UID/unlinked email scope, other owner rejection, metadata changes, exact browser-style bank upserts before/after.
- Bank setup first demonstrates the intermediate deny policy. It then executes the archived `20260211_artists_bank_accounts_rls.sql` in this disposable database only. The necessary `v_my_external_user_ids` DDL is absent from the repository, so the fixture explicitly supplies a text-valued, owner-filtered invoker view. This is a contract test, not evidence of the current production definition or migration application order.
- `certificate.test.ts`: actual SDK/PostgREST/PostgreSQL view, normal hex/base64 tokens, exact expiry, revoked/used/wrong-entry tokens, null-expiry legacy behavior, eight parallel ONE_TIME claims with one success, and real revoke/expiry updates between view lookup and claim. The fetch hook injects a real state change; it does not fake DB results. Only the framework `server-only` marker is resolved for the test runner.
- `http.mjs`: actual Next dev issue API, HTML and text/x-component RSC, absence of private canaries, invalid links causing no issuance, and privacy on key/locale branches. Only external font loading is replaced by `font-responses.cjs`.
- `source.json` records the checked-out HEAD, dirty-diff hash and hashes of the actual relevant source/harness files. If testing before a commit, this is explicitly a HEAD-plus-diff result; it is not relabeled as an exact committed-HEAD run.

Share only `acceptance.json`, `source.json`, `certificate-view-executed.txt`, and the credential-free certificate assertion log. `runtime.json` and `*.private.log` can contain generated fixture tokens and must not be published. HTTP bodies are asserted in memory, not saved. No browser screenshots are taken. Cleanup does not imply a production change.

## Claim semantics

ONE_TIME authorizes at the conditional UPDATE's database transaction time: the link must still have the same entry ID, be unrevoked, be unused, and have null expiry or expiry later than the DB's `now` input. A real revoke/expiry committed before that UPDATE is rejected without consuming the link. A completed claim is not retroactively undone by later revocation. Non-ONE_TIME requests use the active-view read as their validation point. This does not promise cancellation of already rendered/downloaded content.

The original archived active view always excludes used links, even with ONE_TIME disabled, and permits null expiry. Issuance always supplies a positive configured TTL. A missing/drifted view fails closed; the runner's fixture creation does not authorize production view restoration or old file-download reopening.
