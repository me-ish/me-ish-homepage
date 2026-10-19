import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

test('disposable dashboard includes the actual payment-stop route with source checksum',()=>{
 const output=join(mkdtempSync(join(tmpdir(),'natori-phase-t.route-')),'browser-app');
 const result=spawnSync(process.execPath,['scripts/natori-phase-0b/prepare-browser.mjs',output],{cwd:process.cwd(),encoding:'utf8'});
 assert.equal(result.status,0);
 const route='src/app/api/natori/admin/payment-stops/route.ts';
 const expected=readFileSync(resolve(route)),copied=readFileSync(join(output,route));
 assert.deepEqual(copied,expected);
 const checksums=JSON.parse(readFileSync(join(output,'source-checksums.json'),'utf8'));
 assert.equal(checksums[route],createHash('sha256').update(expected).digest('hex'));
 assert.ok(readFileSync(join(output,'src/features/natori/components/dashboard/PaymentStopStatusPanel.tsx'),'utf8').includes('/api/natori/admin/payment-stops'));
});
