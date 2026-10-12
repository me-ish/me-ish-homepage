import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,copyFileSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {assertNoEnvFiles} from './env-guard.mjs';
const scripts=fileURLToPath(new URL('.',import.meta.url));
function isolated(fn){const directory=mkdtempSync(join(tmpdir(),'pr162-env-guard-'));try{return fn(directory);}finally{rmSync(directory,{recursive:true,force:true});}}
test('clean directory is accepted without file contents or network',()=>isolated(directory=>assert.doesNotThrow(()=>assertNoEnvFiles(directory))));
test('unreadable env file is rejected by its name; no contents enter the error',()=>isolated(directory=>{
 writeFileSync(join(directory,'.env.local'),'PRIVATE_FIXTURE_MARKER=not-a-real-secret',{mode:0o000});
 assert.throws(()=>assertNoEnvFiles(directory),error=>error.message.includes('.env.local')&&!error.message.includes('PRIVATE_FIXTURE_MARKER'));
}));
test('dangling .env symlink is rejected without following it',()=>isolated(directory=>{
 symlinkSync(join(directory,'missing-private-target'),join(directory,'.env.development'));
 assert.throws(()=>assertNoEnvFiles(directory),/Environment files present/);
}));
test('actual runner refuses .env before dependency lookup, Docker, HTTP or checkout reads',()=>isolated(directory=>{
 const copy=join(directory,'scripts/legacy-entry-read-security/acceptance');mkdirSync(copy,{recursive:true});
 copyFileSync(join(scripts,'run.mjs'),join(copy,'run.mjs'));copyFileSync(join(scripts,'env-guard.mjs'),join(copy,'env-guard.mjs'));
 writeFileSync(join(directory,'.env'),'DO_NOT_READ_OR_CONNECT=not-a-real-secret',{mode:0o000});
 const result=spawnSync(process.execPath,[join(copy,'run.mjs')],{cwd:directory,env:{PATH:'/no-executables'},encoding:'utf8',timeout:10000});
 assert.notEqual(result.status,0);assert.match(result.stderr,/Environment files present/);
 assert.ok(!result.stderr.includes('DO_NOT_READ_OR_CONNECT'));
 assert.ok(!result.stdout.includes('Synthetic acceptance directory'));
 assert.ok(!result.stderr.includes('Install locked dependencies'));
}));
