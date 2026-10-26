import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plan } from './plan.mjs';
import { fixtureRows, provision, validateEnvironment } from './setup.mjs';
import { assertFixtureChronology } from './fixture-chronology.mjs';

const now = Date.parse('2026-10-24T03:00:00Z');
function environment() {
  return { NATORI_CASE_INITIAL_PREVIEW_SETUP: plan.target.run, VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview', VERCEL_PROJECT_ID: plan.target.project,
    NATORI_CASE_ACCEPTANCE_TARGET: JSON.stringify(plan.target), NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET: JSON.stringify(plan.target),
    SUPABASE_URL: plan.target.url, NEXT_PUBLIC_SUPABASE_URL: plan.target.url, NEXT_PUBLIC_SITE_URL: plan.target.origin,
    NATORI_OWNER_USER_ID: plan.actors.owner.id, NATORI_STAFF_EMAILS: plan.actors.staff.email,
    NATORI_CASE_ACCEPTANCE_MAIL_SCOPE: plan.scope, NATORI_CASE_ACCEPTANCE_STRIPE_ACCOUNT: plan.account,
    NATORI_CASE_DASHBOARD_PREVIEW_ENABLED: 'read-only', NATORI_NOTIFICATION_SENDING_ENABLED: '0',
    STRIPE_SECRET_KEY: 'sk_test_synthetic_offline_not_real', RESEND_API_KEY: 're_synthetic_offline_not_real',
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-key-not-real',
    NATORI_CASE_INITIAL_PREVIEW_PASSWORDS: JSON.stringify({ owner: 'o'.repeat(40), staff: 's'.repeat(40), outsider: 'x'.repeat(40) }) };
}
function fake() {
  const users = [], db = Object.fromEntries(Object.keys(fixtureRows()).map(t => [t, []])), calls = [];
  return { users, db, calls, async fetch(address, options) {
    calls.push({ address, method: options.method });
    assert.equal(new URL(address).origin, plan.target.url); assert.equal(options.redirect, 'error');
    const u = new URL(address), input = options.body && JSON.parse(options.body);
    if (u.pathname === '/auth/v1/admin/users') {
      if (options.method === 'GET') return Response.json({ users, total: users.length });
      assert.equal(options.method, 'POST'); assert.equal(input.email_confirm, true);
      assert.equal(input.role, undefined); assert(input.email.endsWith('@example.invalid'));
      const user = { id: input.id, email: input.email, app_metadata: input.app_metadata, email_confirmed_at: plan.target.startsAt, role: 'authenticated' };
      users.push(user); return Response.json(user);
    }
    const table = u.pathname.split('/').pop(); assert(Object.hasOwn(db, table));
    if (options.method === 'GET') return Response.json(db[table], { headers: { 'content-range': `0-${Math.max(0, db[table].length - 1)}/${db[table].length}` } });
    if (options.method === 'PATCH') {
      const row = db[table].find(r => r.id === plan.projects.registered); assert(!row.active_quote_id);
      Object.assign(row, input); return Response.json([row]);
    }
    assert.equal(options.method, 'POST'); db[table].push(...structuredClone(input)); return Response.json(input);
  } };
}

test('private preparation creates only three confirmed synthetic users and six bounded rows; disabled run has no recipients', async () => {
  const f = fake(), result = await provision(environment(), f.fetch, now);
  assert.equal(result.createdUsers, 3); assert.equal(result.insertedRows, 6); assert.equal(result.enabled, false);
  assert.equal(f.calls.filter(c => c.method === 'PATCH').length, 1);
  assert(f.calls.slice(0, 5).every(c => c.method === 'GET'));
  assert.deepEqual(f.db.natori_case_acceptance_runs[0].allowed_to, []);
  assert.equal(f.db.natori_case_acceptance_runs[0].used, 0);
  assert.equal(f.db.natori_projects[0].payment_link_id, null);
  assert.equal(f.db.natori_projects[0].active_quote_id, plan.quote);
  const second = await provision(environment(), f.fetch, now);
  assert.equal(second.createdUsers, 0); assert.equal(second.insertedRows, 0);
  assert.equal(f.calls.filter(c => c.method !== 'GET').length, 8);
  assert(!JSON.stringify(result).includes('password'));
});
for (const [name, mutate] of [
  ['production', e => e.VERCEL_ENV = 'production'], ['another project', e => e.VERCEL_PROJECT_ID = 'prj_other'],
  ['production database', e => e.SUPABASE_URL = 'https://lvnfspyainrxtztjytbo.supabase.co'],
  ['arbitrary URL', e => e.NEXT_PUBLIC_SITE_URL = 'https://attacker.invalid'],
  ['missing explicit setup', e => delete e.NATORI_CASE_INITIAL_PREVIEW_SETUP],
  ['sender enabled', e => e.NATORI_NOTIFICATION_SENDING_ENABLED = '1'],
  ['live provider key', e => e.STRIPE_SECRET_KEY = 'sk_live_synthetic'],
  ['extra access', e => e.ADMIN_EMAILS = 'arbitrary@example.invalid'],
  ['wrong public marker', e => e.NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET += ' '],
  ['missing password', e => delete e.NATORI_CASE_INITIAL_PREVIEW_PASSWORDS],
]) test(`fails before network: ${name}`, async () => {
  const env = environment(); mutate(env); const f = fake();
  await assert.rejects(provision(env, f.fetch, now)); assert.equal(f.calls.length, 0);
});
test('exact expiry rejects setup', () => assert.throws(() => validateEnvironment(environment(), Date.parse(plan.target.endsAt)), /setup_window_expired/));
test('explicit synthetic times stay coherent for delayed setup without DB default creation times', async () => {
  const rows = fixtureRows(), p = rows.natori_projects[0], q = rows.natori_quotes[0];
  assert.equal(p.created_at, plan.fixtureTimes.projectCreatedAt);
  assert.equal(q.created_at, plan.fixtureTimes.quoteCreatedAt);
  assert.equal(q.issued_at, plan.fixtureTimes.issuedAt);
  assert.equal(q.accepted_at, plan.fixtureTimes.acceptedAt);
  assertFixtureChronology({ ...p, updated_at: new Date(now).toISOString(), quote_accepted_at: q.accepted_at }, q, now);
  const f = fake(); await provision(environment(), f.fetch, now);
  assert.equal(f.db.natori_projects[0].quote_accepted_at, q.accepted_at);
  assert.equal(f.db.natori_quotes[0].created_at, q.created_at);
});
test('setup before the planned synthetic facts stops before any read or write', async () => {
  const f = fake();
  await assert.rejects(provision(environment(), f.fetch, Date.parse(plan.target.startsAt)), /fixture_chronology/);
  assert.equal(f.calls.length, 0);
});
test('old contradictory rows are not silently updated by setup', async () => {
  const f = fake(); await provision(environment(), f.fetch, now);
  f.db.natori_quotes[0].issued_at = plan.target.startsAt;
  f.db.natori_quotes[0].accepted_at = plan.target.startsAt;
  f.db.natori_projects[0].quote_accepted_at = plan.target.startsAt;
  const before = JSON.stringify(f.db); f.calls.length = 0;
  await assert.rejects(provision(environment(), f.fetch, now), /setup_existing_record_mismatch/);
  assert.equal(JSON.stringify(f.db), before); assert(f.calls.every(call => call.method === 'GET'));
});
test('unrecognized existing row stops before creating Auth or overwriting data', async () => {
  const f = fake(); f.db.natori_projects.push({ id: 'unrecognized' });
  await assert.rejects(provision(environment(), f.fetch, now), /setup_unexpected_data/);
  assert(f.calls.every(c => c.method === 'GET'));
});
test('pre-existing human Auth or forged synthetic identity is not adopted', async () => {
  for (const user of [{ id: 'foreign', email: 'person@example.com' }, { ...plan.actors.owner, role: 'authenticated', email_confirmed_at: plan.target.startsAt }]) {
    const f = fake(); f.users.push(user);
    await assert.rejects(provision(environment(), f.fetch, now), /setup_auth_identity_mismatch/);
    assert(f.calls.every(c => c.method === 'GET'));
  }
});
test('unconfirmed Auth write is not retried and exposes only a static error', async () => {
  const f = fake(); let writes = 0;
  await assert.rejects(provision(environment(), async (url, options) => {
    if (options.method === 'POST') { writes++; throw Error('private response must not leak'); }
    return f.fetch(url, options);
  }, now), { message: 'setup_transport_outcome_unconfirmed' });
  assert.equal(writes, 1);
});
test('partial collection is not interpreted as empty', async () => {
  const f = fake(); await assert.rejects(provision(environment(), async (url, opts) => url.includes('/rest/')
    ? Response.json([], { headers: { 'content-range': '0-0/*' } }) : f.fetch(url, opts), now), /setup_collection_incomplete/);
  assert(f.calls.every(c => c.method === 'GET'));
});
test('stopped run changed to enabled or spent cannot be silently restored', async () => {
  const f = fake(); await provision(environment(), f.fetch, now); f.db.natori_case_acceptance_runs[0].enabled = true;
  f.calls.length = 0; await assert.rejects(provision(environment(), f.fetch, now), /setup_existing_record_mismatch/);
  assert(f.calls.every(c => c.method === 'GET'));
});
test('interrupted preparation resumes by exact IDs, without updating passwords', async () => {
  const f = fake(); let n = 0;
  await assert.rejects(provision(environment(), async (u, o) => {
    if (o.method === 'POST' && ++n === 3) throw Error('interrupted'); return f.fetch(u, o);
  }, now), /setup_transport_outcome_unconfirmed/);
  assert.equal(f.users.length, 2);
  const result = await provision(environment(), f.fetch, now); assert.equal(result.createdUsers, 1);
  assert(!f.calls.some(c => c.method === 'PUT' || c.method === 'DELETE'));
});
