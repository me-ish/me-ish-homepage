// Current-source schema prerequisite; source-only, no DB/provider/runtime secrets.
import {readFileSync,realpathSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
if(process.argv.length!==3)throw Error('SCHEMA_SOURCE_ROOT_REQUIRED');
const root=realpathSync(process.argv[2]);
const expected={
  "supabase/migrations/20261001223805_natori_task_integrity.sql": {
    "sha256": "643df4fbfb7373b3fdbb70d902f5d60a631e13cdfa0e9d4d11ecbfb8a58bc1dc",
    "raw": true
  },
  "src/features/natori/server/taskIntegrityService.ts": {
    "sha256": "ac5d1527cd3dfc7befc19f26fd371f8bfa51939c383aaf830198b344b4b986c0",
    "raw": false
  },
  "src/features/natori/server/projectsService.ts": {
    "sha256": "8f90f8f620af4e5ec0c59c0063f3a3e1709a9d445cb4f36be557ad00c7155f68",
    "raw": false
  },
  "scripts/natori-phase-6a/build-fixture.mjs": {
    "sha256": "3179cdf1402306567b3651cc5a4785c3c16e7604c80993f899ea32ca7dc3386f",
    "raw": true
  },
  "scripts/natori-phase-6a/alias-preflight.sql": {
    "sha256": "7d46bfcea146315c228b6e453065d0b0a22e2b797c3bac1f55f95033abf29be4",
    "raw": true
  },
  "scripts/natori-phase-6a/standalone-read-prerequisites.sql": {
    "sha256": "8338ebfa3ecaf452300585ff65af58e7fb5e8c575601468ff4645fa7e62b214c",
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
