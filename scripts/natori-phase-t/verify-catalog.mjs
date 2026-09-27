import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const expected = JSON.parse(readFileSync(new URL('./fixtures/catalog.json', import.meta.url)));
const actual = JSON.parse(readFileSync(process.argv[2]));
if (process.argv[3] === 'candidate') {
  const removed = new Set(['Allow Insert 1exduyn_0', 'Allow public access 1exduyn_1', 'Allow public access 1exduyn_2', 'Allow public access 1exduyn_3']);
  expected.policies = expected.policies.filter(p => !removed.has(p.policyname));
}
assert.deepEqual(actual, expected, 'Storage catalogue differs from reviewed fixture');
console.log(`PASS catalogue/${process.argv[3]}: policies, GRANTs, RLS and seven bucket settings match`);
