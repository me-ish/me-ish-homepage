import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import { guardedFetch } from './guard.mjs';

const mode = process.argv[2];
if (!['current', 'candidate'].includes(mode)) throw new Error('PHASE_T_MODE_REQUIRED');
const { origin } = JSON.parse(readFileSync('/runtime/network.json'));
const request = guardedFetch(process.env.PHASE_T_API_URL ?? origin, origin);
const { anon, service } = JSON.parse(readFileSync('/runtime/credentials.json'));
const results = [];
const check = (ok, code) => { if (!ok) throw new Error(code); };
const bytes = (s) => Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHM8AAAAASUVORK5CYII=', 'base64'), Buffer.from(s)]);
const original = bytes('synthetic-original');
const changed = bytes('synthetic-changed');
const headers = (token, extra = {}) => ({ apikey: anon, Authorization: `Bearer ${token}`, ...extra });
const json = (token) => headers(token, { 'content-type': 'application/json' });
async function api(path, method, token, body, extra = {}) {
  return request(path, { method, headers: headers(token, extra), body });
}
async function responseJson(r) { try { return await r.json(); } catch { throw new Error(`NON_JSON_HTTP_${r.status}`); } }
async function success(r, label) { check(r.ok, `${label}_HTTP_${r.status}`); return r; }
async function get(bucket, key, token = service) {
  return api(`/storage/v1/object/${bucket}/${key}`, 'GET', token);
}
async function content(bucket, key, expected) {
  const r = await success(await get(bucket, key), 'READ_BACK');
  check(Buffer.from(await r.arrayBuffer()).equals(expected), 'OBJECT_BYTES_DIFFER');
}
async function absent(bucket, key) {
  const r = await get(bucket, key);
  const b = await responseJson(r);
  check(!r.ok && [400, 404].includes(r.status) && /not.?found/i.test(`${b.error} ${b.message} ${b.code}`), 'OBJECT_NOT_CONFIRMED_ABSENT');
}
async function upload(bucket, key, token, value = original, method = 'POST') {
  return api(`/storage/v1/object/${bucket}/${key}`, method, token, value, { 'content-type': 'image/png' });
}
async function seed(bucket, key) { await success(await upload(bucket, key, service), 'SEED'); await content(bucket, key, original); }
async function remove(bucket, key, token) {
  return request(`/storage/v1/object/${bucket}`, { method: 'DELETE', headers: json(token), body: JSON.stringify({ prefixes: [key] }) });
}
async function rlsDenied(r) {
  const b = await responseJson(r);
  check(!r.ok && [400, 403].includes(r.status) && /row.level security|AccessDenied|Unauthorized|permission denied/i.test(`${b.error} ${b.message} ${b.code}`), `EXPECTED_RLS_DENIAL_HTTP_${r.status}`);
}
async function test(name, fn) {
  try { await fn(); results.push({ name, status: 'passed' }); console.log(`PASS ${mode}/${name}`); }
  catch (e) {
    // Never print request URLs, response bodies, keys, JWTs or assertion values.
    const safe = /^[A-Z_0-9]+$/.test(e.message) ? e.message : 'UNEXPECTED_TEST_ERROR';
    results.push({ name, status: 'failed', code: safe }); console.log(`FAIL ${mode}/${name} ${safe}`);
  }
}

const actors = {};
await test('environment/auth-storage-buckets', async () => {
  await success(await api('/auth/v1/health', 'GET', anon), 'AUTH_HEALTH');
  const r = await success(await api('/storage/v1/bucket', 'GET', service), 'BUCKETS');
  const buckets = await responseJson(r);
  for (const id of ['artworks', 'avatars', 'banners', 'natori-inquiry-refs', 'natori-consultations', 'natori-deliveries', 'processing-meta']) {
    check(buckets.some(b => b.id === id), 'EXPECTED_BUCKET_MISSING');
  }
  for (const name of ['owner', 'other']) {
    const email = `${mode}-${name}-${randomUUID()}@example.invalid`;
    const password = randomBytes(32).toString('base64url');
    const created = await request('/auth/v1/admin/users', { method: 'POST', headers: json(service), body: JSON.stringify({ email, password, email_confirm: true }) });
    const user = await responseJson(await success(created, 'CREATE_USER'));
    const signedIn = await request('/auth/v1/token?grant_type=password', { method: 'POST', headers: json(anon), body: JSON.stringify({ email, password }) });
    const session = await responseJson(await success(signedIn, 'SIGN_IN'));
    check(!!session.access_token && user.id === session.user.id, 'USER_SESSION_MISMATCH');
    actors[name] = { id: user.id, token: session.access_token };
    const identity = await responseJson(await success(await api('/auth/v1/user', 'GET', session.access_token), 'IDENTITY'));
    check(identity.id === user.id, 'AUTHENTICATION_NOT_PROVEN');
  }
});
// No skip/success if authentication or service startup failed.
if (!actors.owner || !actors.other) {
  writeFileSync(`/results/${mode}.json`, JSON.stringify({ mode, results, passed: 0, failed: 1, skipped: 0 }, null, 2));
  process.exit(1);
}

const privateBuckets = ['natori-inquiry-refs', 'natori-consultations', 'natori-deliveries'];
for (const bucket of ['artworks', ...privateBuckets, 'avatars', 'banners', 'processing-meta']) {
  await test(`anonymous-insert/${bucket}`, async () => {
    const key = `${mode}/arbitrary-${randomUUID()}.png`;
    await absent(bucket, key);
    const r = await upload(bucket, key, anon);
    if (mode === 'current') { await success(r, 'CURRENT_INSERT'); await content(bucket, key, original); }
    else { await rlsDenied(r); await absent(bucket, key); }
  });
}
for (const [name, token] of [['anon', anon], ['authenticated-other', actors.other.token]]) {
  for (const method of ['PUT', 'DELETE']) {
    await test(`third-party-artworks/${name}/${method}`, async () => {
      const key = `${actors.owner.id}/${mode}-${method}-${name}.png`;
      await success(await upload('artworks', key, service), 'SEED');
      await content('artworks', key, original);
      // Public SELECT must expose the same existing object to the tested actor.
      const before = await success(await get('artworks', key, token), 'ACTOR_SELECT');
      check(Buffer.from(await before.arrayBuffer()).equals(original), 'ACTOR_SELECT_BYTES');
      const r = method === 'PUT' ? await upload('artworks', key, token, changed, 'PUT') : await remove('artworks', key, token);
      if (mode === 'current') {
        await success(r, 'CURRENT_MUTATION');
        if (method === 'PUT') await content('artworks', key, changed); else await absent('artworks', key);
      } else {
        if (method === 'PUT') await rlsDenied(r);
        else {
          // Storage DELETE may report 200 + [] when RLS filters every row.
          const removed = await responseJson(await success(r, 'FILTERED_DELETE'));
          check(Array.isArray(removed) && removed.length === 0, 'DELETE_NOT_FILTERED');
        }
        await content('artworks', key, original);
      }
    });
  }
}
for (const bucket of ['artworks', ...privateBuckets]) {
  await test(`service-crud/${bucket}`, async () => {
    const key = `${mode}/service-${randomUUID()}.png`;
    await seed(bucket, key);
    await success(await upload(bucket, key, service, changed, 'PUT'), 'SERVICE_UPDATE');
    await content(bucket, key, changed);
    await success(await remove(bucket, key, service), 'SERVICE_DELETE');
    await absent(bucket, key);
  });
}
await test('service-artworks-copy-and-processing-meta', async () => {
  const key = `${mode}/copy-source.png`, target = `pending-processing/${key}`;
  await seed('artworks', key);
  await success(await request('/storage/v1/object/copy', { method: 'POST', headers: json(service), body: JSON.stringify({ bucketId: 'artworks', sourceKey: key, destinationKey: target }) }), 'COPY');
  await content('artworks', target, original);
  const metaKey = `${mode}/pending.json`, body = Buffer.from('{"synthetic":true}');
  await success(await api(`/storage/v1/object/processing-meta/${metaKey}`, 'POST', service, body, { 'content-type': 'application/json' }), 'META_UPLOAD');
  await content('processing-meta', metaKey, body);
});
for (const bucket of ['avatars', 'banners']) {
  await test(`owner-and-other/${bucket}`, async () => {
    const key = `${actors.owner.id}/${mode}.png`;
    await success(await upload(bucket, key, actors.owner.token), 'OWNER_UPLOAD');
    await content(bucket, key, original);
    await success(await upload(bucket, key, actors.owner.token, changed, 'PUT'), 'OWNER_UPDATE');
    await content(bucket, key, changed);
    await rlsDenied(await upload(bucket, key, actors.other.token, original, 'PUT'));
    await content(bucket, key, changed);
    const removed = await responseJson(await success(await remove(bucket, key, actors.other.token), 'OTHER_DELETE'));
    check(Array.isArray(removed) && removed.length === 0, 'OWNER_DELETE_NOT_FILTERED');
    await content(bucket, key, changed);
    await success(await remove(bucket, key, actors.owner.token), 'OWNER_DELETE');
    await absent(bucket, key);
  });
}
for (const bucket of ['artworks', 'avatars', 'banners', ...privateBuckets]) {
  await test(`public-private-read/${bucket}`, async () => {
    const key = `${mode}/read-${randomUUID()}.png`;
    await seed(bucket, key);
    const r = await request(`/storage/v1/object/public/${bucket}/${key}`);
    if (privateBuckets.includes(bucket)) {
      check([400, 404].includes(r.status), 'PRIVATE_PUBLIC_READ_ALLOWED');
      const denied = await get(bucket, key, anon);
      check([400, 403, 404].includes(denied.status), 'PRIVATE_ANON_READ_ALLOWED');
      await content(bucket, key, original);
    } else {
      await success(r, 'PUBLIC_READ');
      check(Buffer.from(await r.arrayBuffer()).equals(original), 'PUBLIC_BYTES_DIFFER');
    }
  });
}
for (const bucket of privateBuckets) {
  await test(`signed-upload-download/${bucket}`, async () => {
    const key = `${mode}/signed-${randomUUID()}.png`;
    const issued = await responseJson(await success(await request(`/storage/v1/object/upload/sign/${bucket}/${key}`, { method: 'POST', headers: json(service), body: '{}' }), 'SIGN_UPLOAD'));
    check(typeof issued.url === 'string' && issued.url.startsWith('/object/upload/sign/'), 'SIGNED_UPLOAD_PATH_INVALID');
    await success(await request(`/storage/v1${issued.url}`, { method: 'PUT', headers: headers(anon, { 'content-type': 'image/png' }), body: original }), 'SIGNED_UPLOAD');
    await content(bucket, key, original);
    const signed = await responseJson(await success(await request(`/storage/v1/object/sign/${bucket}/${key}`, { method: 'POST', headers: json(service), body: '{"expiresIn":120}' }), 'SIGN_READ'));
    check(typeof signed.signedURL === 'string' && signed.signedURL.startsWith('/object/sign/'), 'SIGNED_READ_PATH_INVALID');
    const r = await success(await request(`/storage/v1${signed.signedURL}`), 'SIGNED_DOWNLOAD');
    check(Buffer.from(await r.arrayBuffer()).equals(original), 'SIGNED_BYTES_DIFFER');
    const altered = issued.url.replace(key, key.replace('.png', '-other.png'));
    const denied = await request(`/storage/v1${altered}`, { method: 'PUT', headers: headers(anon, { 'content-type': 'image/png' }), body: changed });
    check(!denied.ok && [400, 403].includes(denied.status), 'SIGNED_SCOPE_BYPASS');
    await absent(bucket, key.replace('.png', '-other.png'));
    await content(bucket, key, original);
  });
}
await test('signed-tus-consultation', async () => {
  const bucket = 'natori-consultations', key = `${mode}/tus-${randomUUID()}.png`;
  const issued = await responseJson(await success(await request(`/storage/v1/object/upload/sign/${bucket}/${key}`, { method: 'POST', headers: json(service), body: '{}' }), 'TUS_SIGN'));
  const signature = new URL(issued.url, origin).searchParams.get('token');
  check(!!signature, 'TUS_SIGNATURE_MISSING');
  const metadata = Object.entries({ bucketName: bucket, objectName: key, contentType: 'image/png', cacheControl: '3600' }).map(([k, v]) => `${k} ${Buffer.from(v).toString('base64')}`).join(',');
  const h = headers(anon, { 'x-signature': signature, 'Tus-Resumable': '1.0.0', 'Upload-Length': String(original.length), 'Upload-Metadata': metadata });
  const created = await success(await request('/storage/v1/upload/resumable', { method: 'POST', headers: h }), 'TUS_CREATE');
  const location = new URL(created.headers.get('location'), origin);
  // Local Storage advertises a localhost URL; use only the returned path on our fixed origin.
  check(location.pathname.startsWith('/storage/v1/upload/resumable/'), 'TUS_LOCATION_INVALID');
  await success(await request(location.pathname, { method: 'PATCH', headers: headers(anon, { 'x-signature': signature, 'Tus-Resumable': '1.0.0', 'Upload-Offset': '0', 'content-type': 'application/offset+octet-stream' }), body: original }), 'TUS_PATCH');
  await content(bucket, key, original);
});
await test('controls-invalid-auth-and-missing-bucket', async () => {
  const invalid = await api('/auth/v1/user', 'GET', 'invalid-disposable-token');
  check([401, 403].includes(invalid.status), 'INVALID_AUTH_CONTROL');
  const missing = await upload('phase-t-does-not-exist', 'missing.png', service);
  const b = await responseJson(missing);
  check(!missing.ok && /bucket.*not found/i.test(`${b.error} ${b.message}`), 'MISSING_BUCKET_CONTROL');
});
const summary = { mode, passed: results.filter(r => r.status === 'passed').length, failed: results.filter(r => r.status === 'failed').length, skipped: 0, results };
writeFileSync(`/results/${mode}.json`, JSON.stringify(summary, null, 2));
console.log(`SUMMARY ${mode}: passed=${summary.passed} failed=${summary.failed} skipped=0`);
if (summary.failed) process.exitCode = 1;
