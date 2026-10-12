import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {buildReaderFixture,prerequisitePaths} from './build-reader-fixture.mjs';

test('initial uses only exact named consultation and rough prerequisites',()=>{
 const fixture=buildReaderFixture('initial');
 assert.deepEqual(fixture.paths,prerequisitePaths);
 assert.match(fixture.sql,/WF01 ephemeral fixture required/);
 assert.match(fixture.sql,/WF01 reader prerequisite must install once/);
 assert.match(fixture.sql,/create function public.natori_record_rough_ok_v1/);
 assert.doesNotMatch(fixture.sql,/create table public.natori_projects/);
});
test('standalone0B adds the existing narrow PhaseN fixture before exact current reader schema',()=>{
 const fixture=buildReaderFixture('standalone-0b');
 assert.equal(fixture.paths.length,prerequisitePaths.length+4);
 assert.match(fixture.sql,/create table public.natori_notification_jobs/);
 assert.doesNotMatch(fixture.sql,/create table public.natori_projects/);
});
test('latePhase3B restores only required purpose choices and never repeats CREATE objects',()=>{
 const fixture=buildReaderFixture('late-phase3b');
 assert.match(fixture.sql,/pg_get_expr\(conbin,conrelid\)/);
 assert.match(fixture.sql,/rough_ok_artist/);
 assert.doesNotMatch(fixture.sql,/create (table|function)/i);
 assert.match(buildReaderFixture('verify-existing').sql,/WF01 reader prerequisite missing/);
});
test('unknown modes and incomplete synthetic source roots fail closed',()=>{
 assert.throws(()=>buildReaderFixture('full-history'),/WF01_FIXTURE_MODE_REJECTED/);
 const root=mkdtempSync(join(tmpdir(),'wf01-builder-negative-'));
 mkdirSync(join(root,'supabase/migrations'),{recursive:true});
 writeFileSync(join(root,prerequisitePaths[0]),'-- synthetic incomplete source\n');
 assert.throws(()=>buildReaderFixture('initial',root),/ENOENT/);
});
