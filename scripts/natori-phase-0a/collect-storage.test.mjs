import test from 'node:test';
import assert from 'node:assert/strict';
import { classify } from './collect-storage.mjs';

test('keeps missing-version cause and deletion correlation without exposing logs', () => {
  const object = 'entry_00000000-0000-4000-8000-000000000001.png';
  const version = '00000000-0000-4000-8000-000000000002';
  const secret = 'sensitive-disposable-test-value';
  const failed = classify(JSON.stringify({time: 100, reqId: 'req-1',
    req: {method: 'GET', url: `/object/artworks/${object}?token=${secret}`,
      headers: {authorization: secret}}, res: {statusCode: 500},
    error: {raw: JSON.stringify({originalError: {code: 'ENOENT',
      path: `/storage/stub/artworks/${object}/${version}`,
      stack: `at FileBackend.getObject (${secret})`}})}, msg: secret}));
  const deleted = classify(JSON.stringify({event: 'ObjectAdminDelete',
    objectPath: `stub/artworks/${object}`, payload: JSON.stringify({name: object, version, token: secret})}));
  assert.deepEqual(failed.errors, ['ENOENT']);
  assert.deepEqual(failed.locations, ['FileBackend.getObject']);
  assert.equal(failed.missingVersions[0], deleted.deletedVersion);
  assert.equal(failed.object, deleted.object);
  const result = JSON.stringify([failed, deleted]);
  for (const raw of [secret, object, version, 'req-1', '/storage/', 'authorization'])
    assert.equal(result.includes(raw), false);
});
test('never copies unknown errors, raw strings or malformed log lines', () => {
  assert.equal(classify('password=do-not-output'), null);
  assert.equal(classify(JSON.stringify({error: {raw: 'secret', message: 'secret', code: 'secret'}})), null);
  assert.equal(classify('null'), null);
});
