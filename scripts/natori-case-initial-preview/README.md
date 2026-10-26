# Initial dedicated read-only Preview

This private build helper is separate from the existing full hosted acceptance
runner. It is not imported by application code or normal `npm run build`.
There is no public setup endpoint or additional test-login route.

The approved target and synthetic IDs are in `plan.mjs`. The one-time Preview
build command is `node scripts/natori-case-initial-preview/setup.mjs && npm run build`.
The helper consumes the existing dedicated Vercel server key inside its build;
it never exports that key, changes grants, applies migrations, sends invitations,
resets passwords, creates a provider object, or deletes records.

Only three confirmed `@example.invalid` users, three synthetic projects, one
synthetic accepted quote, one **disabled** acceptance run and one membership are
prepared. The registered case has no payment link, payment, or sent notification.
The other projects exercise unregistered and foreign-owner denial. The run has
empty recipient lists, no human quota and zero spending. Its synthetic provider
scope/account are metadata, not proof of a real provider connection.

Before all writes, existing Auth identities and all four target tables must
contain only matching fixture records. Unexpected data stops setup. Existing
passwords are never overwritten. A failed or unconfirmed write is not retried
automatically: inspect managed Auth/DB state first. A later explicitly initiated
run checks exact IDs before continuing an interrupted preparation.

New synthetic passwords go only into the protected Work directory outside Git
and sensitive Preview-only environment variables. Never print them, save browser
sessions/HAR, decrypt existing Vercel keys, or include secrets in source archives.
No Google OAuth or real provider acceptance is claimed by password-based checks.

## Protected password-login correction (2026-10-24)

This preserved correction is on hold after the user chose Google login.
The explicit Google package and its external prerequisites are described in
`docs/natori-case-preview-google-login-20261024.md`. Build locally with
`node scripts/natori-case-initial-preview/build-google-package.mjs /workspace/NEW_OUTPUT`
or use `verify-offline.mjs /workspace/NEW_OUTPUT --google` for a socket-denied build.
Its private launchers must explicitly use the third argument `'google'`.
The Google preflight makes GET reads only; do not rerun password setup after a
human Google identity exists. No external configuration/deployment is performed
by these local packaging commands.

The approved correction replaces the existing `/admin-login` page/client only in
the dedicated package. It uses the ordinary browser Supabase SDK password grant
for the three existing synthetic identities; the normal server staff/owner and
fixture checks remain authoritative. No Auth bypass, new user, credential reset,
Google provider, callback access or application login API is added.

The server page validates the actual Preview/project/DB/read-only/sender-off
configuration before Auth reads. The client compares all nonsecret target fields
with the public build marker and actual origin before Auth operations. Passwords
are user input only: never page props, build constants, source archives, logs or
URL parameters. A rapid repeated submit is ignored; an uncertain Auth result
requires explicit reload/logout rather than automatic retry. A fixed cases GET
revalidates normal authorization after login. The existing dashboard layout gets
a link back to the same protected login/logout page. Google is clearly unused.
The normal login page, middleware and dashboard layout are untouched outside
this package. All business POSTs/Cron/provider/Webhook/Storage paths stay closed.

The extra deployment allowance is one, still unused at the local checkpoint.
There is no supported secret-delivery tool in this Work's current catalog.
Do not deploy expecting that the user can obtain a password from the chat or
from a newly published secret-reveal endpoint. Confirm an approved private
delivery method first; no new secret transfer or persistent-access setting has
been performed. The run end time does not revoke an Auth account/password.

Targeted UI/auth tests are in
`src/features/natori/server/__tests__/initialPreviewPasswordLogin.test.tsx`.
The loopback-only browser regression is:

```sh
node scripts/natori-case-initial-preview/verify-password-browser.mjs \
  /workspace/NEW_PASSWORD_UI_EVIDENCE /workspace/COMPLETED_OFFLINE_BUILD_EVIDENCE
```

It uses real browser/server Supabase SSR SDKs, cookies, existing staff checks
and the offline production CSS. Auth HTTP, case data/page, Next cookie adaptation
and the local target are test boundaries. It does not prove hosted Auth,
middleware/DB integration, real credentials, Google OAuth or physical iPhone.

Keep Vercel protection, the read-only flag, disabled run, sender-off flag and
nonworking Stripe/Resend build placeholders. Do not open the production gates.
Vercel protection access is a separate capability: never disable protection or
generate an unapproved bypass credential to make the browser check pass.

Synthetic tests: `node --test scripts/natori-case-initial-preview/setup.test.mjs`.
Deployment limit for this approval: initial build plus one necessary correction.

## Local candidate after the deployment review rejection

`package.mjs` makes a separate read-only package without changing the normal
`vercel.json` or `src/middleware.ts`. Both its archive and inline deployment
configuration have `crons: []`. Its middleware overlay catches every path,
rejects Production/missing/wrong platform metadata, rejects every method other
than GET/HEAD, and permits only seven existing API readers. Cron URLs, payment,
mail, webhook and upload APIs are unreachable through this package. Normal
authentication and owner checks still apply to permitted readers.

The standalone `platform-gate.mjs` must run before extraction/npm install and
again before setup/build. It requires the real `VERCEL_ENV=preview`,
`VERCEL_TARGET_ENV=preview`, dedicated project and database URLs, read-only UI
and sender-off setting. It contains no SDK or secret-reading code.

Local checks:

```sh
node --test scripts/natori-case-initial-preview/setup.test.mjs scripts/natori-case-initial-preview/safety.test.mjs
node scripts/natori-case-initial-preview/verify-offline.mjs /workspace/NEW_OUTPUT_DIRECTORY
```

These commands do not upload or deploy. The offline build uses nonworking keys,
denies all socket connections and substitutes only remote Google Font CSS.
Neither package creation nor a source-level guard can dictate Vercel's deployment
record classification. An existing failed first deployment must remain present;
the official API uses an omitted `requestBody.target` for subsequent Previews.
The previously rejected deployment request remains unexecuted. A new source
upload/deployment requires a separate next-step review of this changed candidate.
