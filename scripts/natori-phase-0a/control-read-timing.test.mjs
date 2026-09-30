import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext, Script } from 'node:vm';
import * as crypto from 'node:crypto';
import { program } from './control-read-timing.mjs';

test('patches only the controlled read and upload windows with valid JavaScript', () => {
  const files = new Map([
    ['/app/dist/storage/backend/file.js', 'class FileBackend { async getObject(bucketName,key,version) {const file="synthetic";const data = await fsp.stat(file);return data;} async uploadObject() {} }'],
    ['/app/dist/storage/uploader.js', 'class Uploader { async completeUpload({bucketId,objectName}) {const db = this.db.asSuperUser();return db;} }'],
  ]);
  const output = [];
  runInNewContext(program, {require: name => name === 'node:crypto' ? crypto : {
    readFileSync: path => files.get(path), writeFileSync: (path, value) => files.set(path,value),
  }, console: {log: value => output.push(JSON.parse(value))}});
  for (const source of files.values()) new Script(source);
  assert.equal(output.length, 1);
  assert.equal(output[0].delayMs, 600);
  assert.notEqual(output[0].originalSHA256, output[0].fixtureSHA256);
  assert.notEqual(output[0].uploaderOriginalSHA256, output[0].uploaderFixtureSHA256);
  assert.match(files.get('/app/dist/storage/uploader.js'), /setTimeout\(resolve,200\)/);
});
test('rejects a changed source before writing either fixture', () => {
  let written = 0;
  assert.throws(() => runInNewContext(program, {require: name => name === 'node:crypto' ? crypto : {
    readFileSync: () => 'unreviewed source', writeFileSync: () => written++,
  }}), /SOURCE_GUARD/);
  assert.equal(written, 0);
});
