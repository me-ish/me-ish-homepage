import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
export async function checkHistorySql({sql,raw,owner,other,check,out}){
 const id=randomUUID();
 sql(`insert into natori_projects(id,user_id,title,client_name,type,status,amount,note) values('${id}','${owner}','履歴の合成案件','架空依頼者','illustration','inquiry',12000,'【支払い依頼メール送信 2026-10-01】宛先: never-export@example.invalid\n支払いリンク: https://example.invalid/never-export');
 insert into natori_project_activity(project_id,user_id,event_type,source_type,source_id,occurred_at) select '${id}','${owner}','quote_issued','quote',gen_random_uuid()::text,'2026-10-01'::timestamptz+g*interval '1 second' from generate_series(1,251) g;`);
 const read=(offset=0,revision=null)=>JSON.parse(sql(`select natori_case_history_page_v1('${owner}','${id}',${offset},${revision?`'${revision}'`:'null'})`));
 const first=read();
 check('history exact owner/project, safe projections, first page and count catalogue',()=>{
  assert.equal(first.projectId,id);assert.equal(first.ownerId,owner);assert.equal(first.total,251);assert.equal(first.rows.length,50);assert.equal(first.next,50);assert.equal(first.counts.activity,251);
  assert.equal(sql(`select natori_case_history_page_v1('${other}','${id}') is null`),'t');
  assert(first.rows.every(r=>r.source==='activity'&&!Object.hasOwn(r,'payload')));
 });
 check('history all pages are complete/unique and preserve exact targets without raising fact limits',()=>{
  const ids=new Set();let p=first;do{for(const row of p.rows){assert(!ids.has(row.id));ids.add(row.id);}if(p.next===null)break;p=read(p.next,first.revision);assert.equal(p.changed,false);}while(true);
  assert.equal(ids.size,251);assert.equal(p.rows.length,1);
 });
 check('history a changed record invalidates old later-page cursors instead of returning a partial success',()=>{
  sql(`insert into natori_project_activity(project_id,user_id,event_type,source_type,source_id) values('${id}','${owner}','quote_issued','quote','synthetic-new')`);
  const p=read(50,first.revision);assert.equal(p.changed,true);assert.equal(p.rows.length,0);
  assert.notEqual(raw(`select natori_case_history_page_v1('${owner}','${id}',50,null)`).status,0);
 });
 check('history is STABLE/INVOKER/empty path/service-only and runs in read-only transactions',()=>{
  assert.equal(sql(`select not prosecdef and provolatile='s' and proconfig=ARRAY['search_path=""']::text[] and not has_function_privilege('anon',oid,'execute') and not has_function_privilege('authenticated',oid,'execute') and has_function_privilege('service_role',oid,'execute') from pg_proc where proname='natori_case_history_page_v1'`),'t');
  assert.equal(raw(`begin read only;set local role service_role;select natori_case_history_page_v1('${owner}','${id}');rollback;`).status,0);
 });
 const metrics=[];
 for(const target of [500,1000]){
  sql(`insert into natori_project_activity(project_id,user_id,event_type,source_type,source_id,occurred_at) select '${id}','${owner}','quote_issued','quote',gen_random_uuid()::text,now() from generate_series(1,${target-Number(read().total)})`);
  const times=[];let bytes=0;
  for(let n=0;n<4;n++){const start=performance.now();const p=read();times.push(performance.now()-start);bytes=Buffer.byteLength(JSON.stringify(p));assert.equal(p.total,target);assert.equal(p.rows.length,50);}
  metrics.push({rows:target,pageRows:50,includesDockerPsqlTransport:true,milliseconds:times,firstPageBytes:bytes});
 }
 writeFileSync(out+'/history-metrics.json',JSON.stringify({scope:'single synthetic case history; local PostgreSQL/Docker/psql only; not hosted performance',metrics},null,2));
 check('history 500/1000 stored records retain bounded response pages and exact totals',()=>assert.equal(metrics.length,2));
 const q=randomUUID(),payment=randomUUID();
 sql(`insert into natori_quotes(id,project_id,user_id,version,title,client_name,to_email,amount,subject,body_snapshot,token_hash,expires_at,created_at,issued_at) values('${q}','${id}','${owner}',7,'合成版','架空依頼者','never-export@example.invalid',12000,'非公開','never-export-body','${randomUUID()}','2026-11-01','2026-10-18','2026-10-18');
 insert into natori_payment_transactions(id,project_id,quote_id,amount,status,received_at) values('${payment}','${id}','${q}',12000,'amount_mismatch','2026-10-19');`);
 check('history quote versions/payment times and legacy metadata are safe, bound and not replaced by bodies or addresses',()=>{
  let p=read();const entries=[...p.rows];while(p.next!==null){p=read(p.next,p.revision);entries.push(...p.rows);}
  assert.equal(entries.find(r=>r.source==='quote').quoteVersion,7);
  assert.match(entries.find(r=>r.source==='payment').occurredAt,/2026-10-19/);
  const v=read();assert.deepEqual(v.legacyEntries,[{dateISO:'2026-10-01',label:'支払い依頼メール送信'}]);
  assert(!JSON.stringify(v).includes('never-export'));assert(!Object.hasOwn(v,'legacyNote'));
 });
}
