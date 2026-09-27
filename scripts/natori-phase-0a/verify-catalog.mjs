import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const expected = JSON.parse(readFileSync(new URL('../natori-phase-t/fixtures/catalog.json', import.meta.url)));
const actual = JSON.parse(readFileSync(process.argv[2]));
for (const [id, publicRead] of [['aura-assets',false],['card-assets',false],['natori-portfolio',true]]) {
  expected.buckets.push({id,public:publicRead,file_size_limit:null,allowed_mime_types:null});
}
expected.buckets.push({id:'gallery-entry-intake',public:false,file_size_limit:10485760,allowed_mime_types:['image/jpeg','image/png']});
expected.buckets.sort((a,b)=>a.id.localeCompare(b.id));
expected.policies.push({policyname:'gallery intake requires signed service access',permissive:'RESTRICTIVE',roles:['anon','authenticated'],cmd:'ALL',qual:"(bucket_id <> 'gallery-entry-intake'::text)",with_check:"(bucket_id <> 'gallery-entry-intake'::text)"});
if (process.argv[3] === 'after') {
  const removed = new Set(['Allow Insert 1exduyn_0','Allow public access 1exduyn_1','Allow public access 1exduyn_2','Allow public access 1exduyn_3']);
  expected.policies = expected.policies.filter(p=>!removed.has(p.policyname));
}
expected.policies.sort((a,b)=>a.policyname.localeCompare(b.policyname, 'en', {sensitivity:'variant'}));
// PostgreSQL's C collation orders uppercase before lowercase; sort both identically for membership equality.
actual.policies.sort((a,b)=>a.policyname.localeCompare(b.policyname, 'en', {sensitivity:'variant'}));
assert.deepEqual(actual,expected);
console.log(`PASS phase0a-catalog/${process.argv[3]}: 11 buckets and exact policies/GRANTs/RLS`);
