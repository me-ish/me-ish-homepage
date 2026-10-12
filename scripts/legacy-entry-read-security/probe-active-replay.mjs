// Probe only a caller-named disposable container owned by this acceptance task.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const name=process.argv[2],output=process.argv[3];
assert.match(name??'',/^pr162-[a-z0-9-]+$/);assert.ok(output);
const owner=execFileSync('docker',['inspect','--format','{{index .Config.Labels "meish.pr162-review"}}',name],{encoding:'utf8'}).trim();assert.equal(owner,name);
assert.equal(execFileSync('docker',['inspect','--format','{{.HostConfig.NetworkMode}}',name],{encoding:'utf8'}).trim(),'none');
const sql=(text,db)=>{try{return {ok:true,stdout:execFileSync('docker',['exec','-i',name,'psql','-X','-q','-At','-v','ON_ERROR_STOP=1','-U','postgres','-d',db],{input:text,encoding:'utf8',stdio:['pipe','pipe','pipe']})};}catch(e){return {ok:false,error:String(e.stderr)};}};
const manifest=JSON.parse(readFileSync(root+'supabase/baseline/manifest.json','utf8'));
const results=[];
for(const [label,ref] of [['before','9abcd1310aba049d512221c2786119af06b12e35'],['after',null]]) {
 const db='active_probe_'+label;assert.ok(sql('CREATE DATABASE '+db+';','postgres').ok);
 assert.ok(sql(readFileSync(root+'scripts/legacy-entry-read-security/fresh-bootstrap.sql','utf8'),db).ok);
 const files=ref?JSON.parse(execFileSync('git',['show',ref+':supabase/baseline/manifest.json'],{cwd:root,encoding:'utf8'})).activeMigrations:manifest.activeMigrations;
 for(const file of files) {
  const bytes=ref?execFileSync('git',['show',ref+':'+file],{cwd:root,encoding:'utf8'}):readFileSync(root+file,'utf8');
  const response=sql(bytes,db);
  if(!response.ok){results.push({label,reference:ref??'working tree',migration:file,error:response.error});break;}
 }
}
assert.equal(results.length,2);assert.equal(results[0].migration,results[1].migration);
assert.match(results[0].error,/natori_quotes_request_snapshot_object_check.*already exists/);
assert.match(results[1].error,/natori_quotes_request_snapshot_object_check.*already exists/);
writeFileSync(output,JSON.stringify({scope:'Full active replay probe; does not claim completion',results},null,2)+'\n');
console.log('CONFIRMED unchanged pre-existing full-replay blocker at '+results[0].migration);
