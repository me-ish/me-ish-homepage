// Private build-only preparation. No HTTP setup route, SQL executor, key export,
// invites, password reset, provider call, schema change, purge or deletion.
import { pathToFileURL } from 'node:url';
import { plan } from './plan.mjs';
import { assertInitialPreviewPlatform } from './platform-gate.mjs';
import { assertFixtureChronology, sameFixtureTime } from './fixture-chronology.mjs';

const check = (value, code) => { if (!value) throw Error(code); };
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const tables = ['natori_projects', 'natori_quotes', 'natori_case_acceptance_runs', 'natori_case_acceptance_projects'];
const assertSubset = (actual, expected) => {
  for (const [key, value] of Object.entries(expected)) {
    const same = /(?:_at|starts_at|ends_at)$/.test(key) && typeof value === 'string'
      ? sameFixtureTime(actual[key], value) : equal(actual[key], value);
    check(same, 'setup_existing_record_mismatch');
  }
};
export function validateEnvironment(env, now = Date.now()) {
  assertInitialPreviewPlatform(env);
  const raw = JSON.stringify(plan.target);
  check(env.NATORI_CASE_INITIAL_PREVIEW_SETUP === plan.target.run, 'setup_not_requested');
  check(env.VERCEL_ENV === 'preview' && env.VERCEL_PROJECT_ID === plan.target.project, 'setup_platform_mismatch');
  check(env.NATORI_CASE_ACCEPTANCE_TARGET === raw && env.NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET === raw, 'setup_target_mismatch');
  check(env.SUPABASE_URL === plan.target.url && env.NEXT_PUBLIC_SUPABASE_URL === plan.target.url
    && env.NEXT_PUBLIC_SITE_URL === plan.target.origin, 'setup_origin_mismatch');
  check(now >= Date.parse(plan.target.startsAt) && now < Date.parse(plan.target.endsAt), 'setup_window_expired');
  const fixture = fixtureRows();
  assertFixtureChronology({ ...fixture.natori_projects[0], updated_at: plan.fixtureTimes.acceptedAt,
    quote_accepted_at: plan.fixtureTimes.acceptedAt }, fixture.natori_quotes[0], now);
  check(env.NATORI_OWNER_USER_ID === plan.actors.owner.id && env.NATORI_STAFF_EMAILS === plan.actors.staff.email, 'setup_actor_mismatch');
  check(env.NATORI_CASE_ACCEPTANCE_MAIL_SCOPE === plan.scope && env.NATORI_CASE_ACCEPTANCE_STRIPE_ACCOUNT === plan.account, 'setup_scope_mismatch');
  check(env.NATORI_CASE_DASHBOARD_PREVIEW_ENABLED === 'read-only' && env.NATORI_NOTIFICATION_SENDING_ENABLED === '0', 'setup_not_readonly');
  check(env.STRIPE_SECRET_KEY === 'sk_test_synthetic_offline_not_real' && env.RESEND_API_KEY === 're_synthetic_offline_not_real', 'setup_provider_configuration');
  for (const name of ['ADMIN_EMAILS', 'NATORI_DASHBOARD_KEY', 'NATORI_CASE_ACCEPTANCE_EVENTS', 'NATORI_STRIPE_MODE',
    'NATORI_PAYMENT_LINK_SENDING_ENABLED', 'NATORI_CASE_PAYMENT_WORKSPACE_ENABLED', 'NATORI_CASE_WORK_ENABLED',
    'NATORI_PAYMENT_LINK_INTEGRITY_ENABLED', 'NATORI_ACCEPTANCE_OUTBOX_ENABLED',
    'NATORI_QUOTE_INTEGRITY_ENABLED', 'NATORI_PAYMENT_INTEGRITY_ENABLED']) check(!env[name], 'setup_unexpected_access');
  check(typeof env.SUPABASE_SERVICE_ROLE_KEY === 'string' && env.SUPABASE_SERVICE_ROLE_KEY.length > 20, 'setup_service_missing');
  const passwords = JSON.parse(env.NATORI_CASE_INITIAL_PREVIEW_PASSWORDS ?? '{}');
  check(equal(Object.keys(passwords).sort(), Object.keys(plan.actors).sort())
    && Object.values(passwords).every(v => typeof v === 'string' && v.length >= 32)
    && new Set(Object.values(passwords)).size === 3, 'setup_password_configuration');
  return passwords;
}

export function fixtureRows() {
  const project = (id, owner, title) => ({ id, user_id: owner, title, client_name: '検証専用の架空依頼者',
    client_email: 'synthetic-client@example.invalid', status: 'quoted', type: 'illustration', amount: 12000,
    due_date: '2026-11-12', next_action: '', payment_confirmed_at: null, payment_link_id: null,
    payment_link_url: null, payment_link_status: null, paid_at: null, paid_amount: null, deleted_at: null,
    ...(id === plan.projects.registered ? { created_at: plan.fixtureTimes.projectCreatedAt } : {}) });
  return {
    natori_projects: [project(plan.projects.registered, plan.actors.owner.id, '架空案件・見積承諾済み／支払案内未送信'),
      project(plan.projects.unregistered, plan.actors.owner.id, '表示禁止・未登録の架空案件'),
      project(plan.projects.foreign, plan.actors.outsider.id, '表示禁止・別ownerの架空案件')],
    natori_quotes: [{ id: plan.quote, project_id: plan.projects.registered, user_id: plan.actors.owner.id,
      version: 1, title: '検証専用の承諾済み見積', client_name: '検証専用の架空依頼者', to_email: 'synthetic-client@example.invalid',
      amount: 12000, subject: '合成見積・送信操作なし', body_snapshot: 'テストで作った承諾記録です。実際の承諾や送信ではありません。',
      // A hash with no known bearer-token preimage, not a deployed test token.
      token_hash: '0'.repeat(64),
      created_at: plan.fixtureTimes.quoteCreatedAt, superseded_at: null,
      expires_at: plan.target.endsAt, issued_at: plan.fixtureTimes.issuedAt, accepted_at: plan.fixtureTimes.acceptedAt }],
    natori_case_acceptance_runs: [{ id: plan.target.run, owner_id: plan.actors.owner.id,
      project_ref: plan.target.ref, origin: plan.target.origin, provider_scope: plan.scope, stripe_account: plan.account,
      starts_at: plan.target.startsAt, ends_at: plan.target.endsAt, enabled: false, allowed_to: [], human_to: [],
      sender: 'synthetic-sender@example.invalid', reply_to: 'synthetic-reply@example.invalid', mail_limit: 12, human_limit: 0, used: 0, human_used: 0 }],
    natori_case_acceptance_projects: [{ run_id: plan.target.run, project_id: plan.projects.registered }],
  };
}

export async function provision(env, transport = fetch, now = Date.now()) {
  const passwords = validateEnvironment(env, now), expected = fixtureRows(), existing = {};
  const request = async (path, method = 'GET', body) => {
    check(path === '/auth/v1/admin/users?page=1&per_page=50' && method === 'GET'
      || path === '/auth/v1/admin/users' && method === 'POST'
      || tables.some(t => path === `/rest/v1/${t}?select=*` && ['GET', 'POST'].includes(method))
      || path === `/rest/v1/natori_projects?id=eq.${plan.projects.registered}&user_id=eq.${plan.actors.owner.id}&active_quote_id=is.null&select=*` && method === 'PATCH', 'setup_route_denied');
    let response;
    try { response = await transport(plan.target.url + path, { method, redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json', Prefer: method === 'GET' ? 'count=exact' : 'return=representation' },
      body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch { throw Error('setup_transport_outcome_unconfirmed'); } // Never auto-retry a write.
    check(response.ok, `setup_http_${response.status}`);
    let value; try { value = await response.json(); } catch { throw Error('setup_response_unconfirmed'); }
    if (method === 'GET' && path.startsWith('/rest/')) {
      const count = response.headers.get('content-range')?.split('/')[1];
      check(count !== undefined && count !== '*' && Array.isArray(value) && Number(count) === value.length, 'setup_collection_incomplete');
    }
    return value;
  };
  // Read ALL known targets before any write. A foreign row or mismatching
  // partially-completed run is a stop, never an overwrite or reset.
  const users = await request('/auth/v1/admin/users?page=1&per_page=50');
  check(Array.isArray(users.users) && users.users.length <= 3 && (!users.total || users.total === users.users.length), 'setup_auth_scope_mismatch');
  for (const user of users.users) {
    const actor = Object.values(plan.actors).find(a => a.id === user.id);
    check(actor && actor.email === user.email && user.email_confirmed_at
      && user.app_metadata?.natori_initial_preview_run === plan.target.run && user.role === 'authenticated', 'setup_auth_identity_mismatch');
  }
  for (const table of tables) {
    existing[table] = await request(`/rest/v1/${table}?select=*`);
    for (const row of existing[table]) {
      const target = expected[table].find(r => table.endsWith('_projects') && table !== 'natori_projects'
        ? r.project_id === row.project_id && r.run_id === row.run_id : r.id === row.id);
      check(target, 'setup_unexpected_data'); assertSubset(row, target);
    }
  }
  const current = existing.natori_projects.find(p => p.id === plan.projects.registered);
  const binding = { active_quote_id: plan.quote, quote_accepted_at: plan.fixtureTimes.acceptedAt, quote_accepted_amount: 12000 };
  if (current?.active_quote_id) assertSubset(current, binding);
  else if (current) check(current.quote_accepted_at === null && current.quote_accepted_amount === null, 'setup_partial_quote_mismatch');
  let createdUsers = 0, insertedRows = 0;
  for (const [role, actor] of Object.entries(plan.actors)) {
    if (users.users.some(u => u.id === actor.id)) continue;
    const value = await request('/auth/v1/admin/users', 'POST', { ...actor, password: passwords[role], email_confirm: true,
      app_metadata: { natori_initial_preview_run: plan.target.run } });
    check(value.id === actor.id && value.email === actor.email && value.email_confirmed_at && value.role === 'authenticated', 'setup_auth_create_unconfirmed');
    createdUsers++;
  }
  for (const table of tables) {
    const rows = expected[table].filter(r => !existing[table].some(x => table === 'natori_case_acceptance_projects'
      ? x.project_id === r.project_id && x.run_id === r.run_id : x.id === r.id));
    if (!rows.length) continue;
    const value = await request(`/rest/v1/${table}?select=*`, 'POST', rows);
    check(Array.isArray(value) && value.length === rows.length, 'setup_insert_unconfirmed');
    for (const row of rows) { const actual = value.find(x => table === 'natori_case_acceptance_projects'
      ? x.project_id === row.project_id && x.run_id === row.run_id : x.id === row.id); check(actual, 'setup_insert_unconfirmed'); assertSubset(actual, row); }
    insertedRows += rows.length;
  }
  if (!current?.active_quote_id) {
    const value = await request(`/rest/v1/natori_projects?id=eq.${plan.projects.registered}&user_id=eq.${plan.actors.owner.id}&active_quote_id=is.null&select=*`, 'PATCH', binding);
    check(Array.isArray(value) && value.length === 1, 'setup_quote_binding_unconfirmed'); assertSubset(value[0], binding);
  }
  // Nonsecret evidence only. No responses, credentials, password hashes or headers.
  return { result: 'prepared-read-only', run: plan.target.run, createdUsers, insertedRows, enabled: false, providerCalls: 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await provision(process.env))); }
  catch (error) {
    const code = error instanceof Error && /^setup_[a-z0-9_]+$/.test(error.message) ? error.message : 'setup_failed';
    console.error(`[initial-preview] ${code}`); process.exitCode = 1;
  }
}
