// Current-source schema prerequisite; source-only, no DB/provider/runtime secrets.
import {readFileSync,realpathSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
if(process.argv.length!==3)throw Error('SCHEMA_SOURCE_ROOT_REQUIRED');
const root=realpathSync(process.argv[2]);
const expected={
  "supabase/migrations/20261001223805_natori_task_integrity.sql": {
    "sha256": "b17ac3a116d7c3b01e2a3e2eea5c8409bcfa06f7b73f4aa718f79532895ef015",
    "raw": true
  },
  "src/features/natori/server/taskIntegrityService.ts": {
    "sha256": "ac5d1527cd3dfc7befc19f26fd371f8bfa51939c383aaf830198b344b4b986c0",
    "raw": false
  },
  "src/features/natori/server/projectsService.ts": {
    "sha256": "16231f733310bcbd569c6ba89c7ab8d0ff35cd6d5a64fe50c126079ec1abff2b",
    "raw": false
  },
  "scripts/natori-phase-6a/build-fixture.mjs": {
    "sha256": "150f4292bf8772b2b540d8f65144405654a87e681a00df0248689f84ce1e2390",
    "raw": true
  },
  "scripts/natori-phase-6a/alias-preflight.sql": {
    "sha256": "7d46bfcea146315c228b6e453065d0b0a22e2b797c3bac1f55f95033abf29be4",
    "raw": true
  },
  "scripts/natori-phase-6a/standalone-read-prerequisites.sql": {
    "sha256": "8338ebfa3ecaf452300585ff65af58e7fb5e8c575601468ff4645fa7e62b214c",
    "raw": true
  },
  "scripts/natori-q03/fixture-prerequisites.mjs": {
    "sha256": "656d82b671e7f381962634a956e6645dd3b16a3b17bbd7a0187151a27fcc36ee",
    "raw": true
  },
  "supabase/migrations/20261017123933_natori_edit_conflict_protection.sql": {
    "sha256": "6ad5a938df8435d3876b2a75e97554afb0700d1df5f1042df848430df5eecc33",
    "raw": true
  },
  "scripts/natori-phase-0b/fixture.sql": {
    "sha256": "6e4a4cfb097eaa8c3c16795f894521201ac891041f2639069d5518eb781d378d",
    "raw": true
  }
};
for(const [name,entry] of Object.entries(expected)){
 const path=realpathSync(resolve(root,name)),child=relative(root,path);
 if(child.startsWith('..')||isAbsolute(child))throw Error('SCHEMA_SOURCE_PATH_REJECTED');
 const raw=readFileSync(path),bytes=entry.raw?raw:Buffer.from(raw.toString('utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n'));
 if(createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('SCHEMA_SOURCE_HASH_MISMATCH');
}
const manifest=JSON.parse(readFileSync(resolve(root,'supabase/baseline/manifest.json'),'utf8'));
const migration='supabase/migrations/20261001223805_natori_task_integrity.sql';
if(!manifest.activeMigrations.includes(migration)||!manifest.requiredSequence.includes(migration.split('/').at(-1))||manifest.checksums['sha256:'+migration]!==expected[migration].sha256)throw Error('SCHEMA_MANIFEST_PREREQUISITE_MISSING');
console.log('PASS coherent-schema-source-prerequisite');
