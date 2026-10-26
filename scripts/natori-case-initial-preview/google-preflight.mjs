// Future approved Preview build only: exact GET verification, never Auth user
// creation, credential changes, fixture repair, provider configuration or mail.
import { pathToFileURL } from 'node:url';
import { plan } from './plan.mjs';
import { googlePlan } from './google-plan.mjs';
import { fixtureRows } from './setup.mjs';
import { assertInitialPreviewPlatform } from './platform-gate.mjs';
import { assertGoogleReadAccess } from './google-deadline.mjs';
import { assertFixtureChronology, sameFixtureTime } from './fixture-chronology.mjs';
const check = (value, code) => { if (!value) throw Error(code); };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sorted = value => [...new Set(value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean))].sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function validateGoogleEnvironment(env, now = Date.now()) {
  assertInitialPreviewPlatform(env);
  assertGoogleReadAccess(env, now);
  check(env.NATORI_CASE_INITIAL_PREVIEW_SETUP === plan.target.run, 'google_preflight_not_requested');
  const marker = JSON.stringify(plan.target);
  check(env.NATORI_CASE_ACCEPTANCE_TARGET === marker && env.NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET === marker
    && env.NEXT_PUBLIC_SITE_URL === plan.target.origin, 'google_preflight_target_mismatch');
  check(now >= Date.parse(plan.target.startsAt) && now < Date.parse(plan.target.endsAt), 'google_preflight_window_expired');
  check(env.NATORI_OWNER_USER_ID === plan.actors.owner.id
    && same(sorted(env.NATORI_STAFF_EMAILS ?? ''), [...googlePlan.staffEmails].sort()), 'google_preflight_actor_mismatch');
  check(env.NATORI_CASE_ACCEPTANCE_MAIL_SCOPE === plan.scope && env.NATORI_CASE_ACCEPTANCE_STRIPE_ACCOUNT === plan.account, 'google_preflight_scope_mismatch');
  for (const name of ['ADMIN_EMAILS', 'NATORI_OWNER_EMAILS', 'NATORI_DASHBOARD_KEY', 'NATORI_CASE_ACCEPTANCE_EVENTS', 'NATORI_STRIPE_MODE',
    'NATORI_PAYMENT_LINK_SENDING_ENABLED', 'NATORI_CASE_PAYMENT_WORKSPACE_ENABLED', 'NATORI_CASE_WORK_ENABLED',
    'NATORI_PAYMENT_LINK_INTEGRITY_ENABLED', 'NATORI_ACCEPTANCE_OUTBOX_ENABLED', 'NATORI_QUOTE_INTEGRITY_ENABLED', 'NATORI_PAYMENT_INTEGRITY_ENABLED']) {
    check(!env[name], 'google_preflight_extra_access');
  }
  check(env.STRIPE_SECRET_KEY === 'sk_test_synthetic_offline_not_real' && env.RESEND_API_KEY === 're_synthetic_offline_not_real', 'google_preflight_provider_disabled');
  check(typeof env.SUPABASE_SERVICE_ROLE_KEY === 'string' && env.SUPABASE_SERVICE_ROLE_KEY.length > 20, 'google_preflight_service_missing');
}

function googleCandidateFromIndex(value) {
  const users = value?.users;
  check(Array.isArray(users) && users.length >= 3 && users.length <= 4
    && (value.total === undefined || value.total === users.length), 'google_preflight_auth_incomplete');
  check(new Set(users.map(u => u.id)).size === users.length && new Set(users.map(u => u.email?.toLowerCase())).size === users.length, 'google_preflight_duplicate_identity');
  for (const actor of Object.values(plan.actors)) {
    const user = users.find(u => u.id === actor.id);
    check(user && user.email === actor.email && user.role === 'authenticated' && user.email_confirmed_at
      && user.app_metadata?.natori_initial_preview_run === plan.target.run, 'google_preflight_original_identity_changed');
  }
  const google = users.filter(u => !Object.values(plan.actors).some(actor => actor.id === u.id));
  for (const user of google) {
    check(uuid.test(user.id) && user.email?.toLowerCase() === googlePlan.email
      && user.role === 'authenticated' && user.email_confirmed_at, 'google_preflight_unexpected_identity');
  }
  return google[0] ?? null;
}
function verifiedGoogleIdentity(user) {
  return Array.isArray(user?.identities) && user.identities.some(identity => identity.provider === 'google'
    && identity.identity_data?.email?.toLowerCase() === googlePlan.email && identity.identity_data?.email_verified === true);
}
export function validateGoogleUsers(value, detail) {
  const candidate = googleCandidateFromIndex(value);
  if (!candidate) {
    check(detail === undefined, 'google_preflight_unexpected_identity');
    return false;
  }
  const user = detail;
  check(user?.id === candidate.id && user.email?.toLowerCase() === googlePlan.email
    && user.role === 'authenticated' && user.email_confirmed_at, 'google_preflight_google_detail_mismatch');
  check(verifiedGoogleIdentity(user), 'google_preflight_google_identity_unverified');
  // A populated contradictory index is not silently replaced. Empty/null or
  // omitted identities are legitimate list projections, not proof of absence.
  if (Array.isArray(candidate.identities) && candidate.identities.length > 0) {
    check(verifiedGoogleIdentity(candidate), 'google_preflight_unexpected_identity');
  } else check(candidate.identities == null || Array.isArray(candidate.identities), 'google_preflight_unexpected_identity');
  return true;
}

function validateTable(actual, expected, table) {
  check(Array.isArray(actual) && actual.length === expected.length, 'google_preflight_fixture_incomplete');
  const key = row => table === 'natori_case_acceptance_projects' ? `${row.run_id}:${row.project_id}` : row.id;
  check(new Set(actual.map(key)).size === actual.length, 'google_preflight_fixture_duplicate');
  for (const row of expected) {
    const found = actual.find(value => key(value) === key(row));
    check(found, 'google_preflight_fixture_missing');
    for (const [field, value] of Object.entries(row)) {
      const equal = /(?:_at|starts_at|ends_at)$/.test(field) && typeof value === 'string'
        ? sameFixtureTime(found[field], value) : same(found[field], value);
      check(equal, 'google_preflight_fixture_changed');
    }
  }
}
export async function verifyGooglePreview(env, transport = fetch, now = Date.now()) {
  validateGoogleEnvironment(env, now);
  let detailPath;
  const tablePaths = Object.keys(fixtureRows()).map(table => `/rest/v1/${table}?select=*`);
  const request = async path => {
    check(typeof path === 'string' && (path === '/auth/v1/settings' || path === '/auth/v1/admin/users?page=1&per_page=50'
      || path === detailPath || tablePaths.includes(path)), 'google_preflight_route_denied');
    let response;
    try { response = await transport(plan.target.url + path, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, Prefer: 'count=exact' } }); }
    catch { throw Error('google_preflight_read_unconfirmed'); }
    check(response.status === 200 && !response.redirected, 'google_preflight_read_failed');
    let value; try { value = await response.json(); } catch { throw Error('google_preflight_read_unconfirmed'); }
    if (path.startsWith('/rest/')) {
      const count = response.headers.get('content-range')?.split('/')[1];
      check(count !== undefined && count !== '*' && Array.isArray(value) && Number(count) === value.length, 'google_preflight_partial_read');
    }
    return value;
  };
  const settings = await request('/auth/v1/settings');
  check(settings?.external?.google === true, 'google_preflight_provider_not_enabled');
  const index = await request('/auth/v1/admin/users?page=1&per_page=50');
  const candidate = googleCandidateFromIndex(index);
  // The Auth admin list does not load identity associations. Fetch only the
  // already validated, explicitly allowed candidate by its exact UUID. Never
  // trust user_metadata or treat an index match as provider verification.
  if (candidate) detailPath = `/auth/v1/admin/users/${candidate.id}`;
  const googleUserPresent = validateGoogleUsers(index, candidate ? await request(detailPath) : undefined);
  check(googleUserPresent || settings.disable_signup === false, 'google_preflight_initial_signup_disabled');
  const expected = fixtureRows(), existing = {};
  // Existing fixture, after setup inserted its quote: the ordinary schema's
  // natori_quote_issue_lifecycle_v1 trigger wrote this legacy hint. The later
  // synthetic acceptance binding does not rewrite it. Keep exact validation;
  // do not change the initial insert fixture or treat the hint as agreement.
  expected.natori_projects.find(row => row.id === plan.projects.registered).next_action = '見積りの承諾待ち';
  for (const table of Object.keys(expected)) {
    existing[table] = await request(`/rest/v1/${table}?select=*`);
  }
  const project = existing.natori_projects.find(row => row.id === plan.projects.registered);
  const quote = existing.natori_quotes.find(row => row.id === plan.quote);
  try { assertFixtureChronology(project, quote, now); }
  catch { throw Error('google_preflight_fixture_chronology'); }
  for (const [table, rows] of Object.entries(expected)) validateTable(existing[table], rows, table);
  check(project.active_quote_id === plan.quote && sameFixtureTime(project.quote_accepted_at, plan.fixtureTimes.acceptedAt)
    && project.quote_accepted_amount === 12000, 'google_preflight_quote_binding_changed');
  return { result: 'verified-existing-google-read-only', originalAuthUsers: 3, googleUserPresent, mutations: 0, providerEnabled: true, runEnabled: false, fixtureChronologyVerified: true,
    googleIdentityCheck: googleUserPresent ? 'exact-admin-user-get' : 'not-present' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await verifyGooglePreview(process.env))); }
  catch (error) {
    const code = error instanceof Error && /^(?:google_preflight|setup)_[a-z0-9_]+$/.test(error.message) ? error.message : 'google_preflight_failed';
    console.error(`[initial-preview] ${code}`); process.exitCode = 1;
  }
}
