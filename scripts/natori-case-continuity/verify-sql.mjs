import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
export async function checkContinuitySql({sql,raw,owner,other,check,name}){
 const project=randomUUID(),quote=randomUUID(),notice=randomUUID(),unknown=randomUUID(),operation=randomUUID();
 const at='2026-10-18T00:00:00Z';
 const payload={from:'Fixture <mail@example.invalid>',to:['owner@example.invalid'],reply_to:'reply@example.invalid',subject:'合成承諾通知',text:'保存済みの合成本文',headers:{'X-Meish-Template':'fixture'}};
 const literal=JSON.stringify(payload).replaceAll("'","''");
 sql(`insert into natori_projects(id,user_id,title,client_name,type,status,amount) values('${project}','${owner}','上限超の合成案件','架空依頼者','illustration','quoted',12000);
 insert into natori_quotes(id,project_id,user_id,version,title,client_name,to_email,amount,subject,body_snapshot,token_hash,expires_at,accepted_at) values('${quote}','${project}','${owner}',1,'合成版','架空依頼者','client@example.invalid',12000,'合成','合成','${randomUUID()}',now()+interval '7 day','${at}');
 update natori_projects set active_quote_id='${quote}',quote_accepted_at='${at}',quote_accepted_amount=12000 where id='${project}';
 insert into natori_notification_jobs(id,project_id,quote_id,notification_key,purpose,status,attempt_no,snapshot,payload,created_at) values('${notice}','${project}','${quote}','continuity/${project}/old','quote_accept_artist','failed',1,jsonb_build_object('acceptedAt','${at}'::timestamptz,'amount',12000),'${literal}'::jsonb,now()-interval '20 day'),('${unknown}','${project}','${quote}','continuity/${project}/unknown','quote_accept_artist','unknown',1,jsonb_build_object('acceptedAt','${at}'::timestamptz,'amount',12000),'${literal}'::jsonb,now()-interval '19 day');
 insert into natori_notification_jobs(project_id,quote_id,notification_key,purpose,status,attempt_no,snapshot,created_at)
 select '${project}','${quote}','continuity/${project}/new/'||g,'quote_accept_artist','unknown',1,jsonb_build_object('acceptedAt','${at}'::timestamptz,'amount',12000),now()-g*interval '1 second' from generate_series(1,250) g;`);
 const read=id=>JSON.parse(sql(`select natori_case_admin_notice_read_v1('${owner}','${project}','${id}')`));
 check('exact old notification read bypasses no cap: original view stays 200 and target is one checked owned row',()=>{
  const list=JSON.parse(sql(`select natori_case_admin_read_v1('${owner}','${project}')`));assert.equal(list.notices.length,200);assert(!list.notices.some(n=>n.id===notice));
  const v=read(notice);assert.equal(v.notices.length,1);assert.equal(v.notices[0].id,notice);assert.equal(v.notices[0].retry_candidate,true);assert.equal(v.selectedNotice.isLatest,true);assert.equal(v.complete,false);
  assert.equal(sql(`select natori_case_admin_notice_read_v1('${other}','${project}','${notice}') is null`),'t');
  assert.equal(raw(`begin read only;set local role service_role;select natori_case_admin_notice_read_v1('${owner}','${project}','${notice}');rollback;`).status,0);
 });
 check('unknown stays nonretryable and exact mail inspection preserves a targeted row outside its old 101 cap',()=>{
  assert.equal(read(unknown).notices[0].retry_candidate,false);
  const v=JSON.parse(sql(`select natori_case_reconciliation_notice_read_v1('${owner}','${project}','${unknown}')`));assert.equal(v.notifications.length,1);assert.equal(v.notifications[0].id,unknown);assert.equal(v.notifications[0].status,'unknown');assert.equal(v.selectedNotice,unknown);
  assert.equal(JSON.parse(sql(`select natori_case_reconciliation_notice_read_v1('${other}','${project}','${unknown}')`)).result,'not_found');
 });
 check('old exact failed target reuses guarded admin retry and same operation receipt without a second intent',()=>{
  const v=read(notice),input=JSON.stringify({command:'retry-notice',notificationId:notice,previewHash:'a'.repeat(64),payload}).replaceAll("'","''");
  const call=`select natori_case_admin_command_v1('${owner}','${operation}','${project}','retry-notice','${v.revision}','${input}'::jsonb,'{"kind":"shared-key"}'::jsonb)`;
  const first=JSON.parse(sql(call));assert.equal(first.result,'queued');const replay=JSON.parse(sql(call));assert.equal(replay.replayed,true);assert.equal(replay.notificationId,first.notificationId);
  const old=read(notice);assert.equal(old.selectedNotice.isLatest,false);assert.equal(old.notices[0].retry_candidate,false);
  assert.equal(sql(`select count(*) from natori_notification_jobs where notification_key='continuity/${project}/old'`),'2');
 });
 const concurrentNotice=randomUUID(),operations=[randomUUID(),randomUUID()];
 sql(`insert into natori_notification_jobs(id,project_id,quote_id,notification_key,purpose,status,attempt_no,snapshot,payload,created_at) values('${concurrentNotice}','${project}','${quote}','continuity/${project}/parallel','quote_accept_artist','failed',1,jsonb_build_object('acceptedAt','${at}'::timestamptz,'amount',12000),'${literal}'::jsonb,now()-interval '21 day')`);
 const current=read(concurrentNotice),input=JSON.stringify({command:'retry-notice',notificationId:concurrentNotice,previewHash:'b'.repeat(64),payload}).replaceAll("'","''");
 const concurrent=await Promise.all(operations.map(id=>new Promise((done,reject)=>{
  const child=spawn('/usr/local/bin/docker',['--host','unix:///var/run/docker.sock','exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-U','postgres'],{stdio:['pipe','pipe','pipe'],env:{PATH:process.env.PATH,LANG:'C.UTF-8'}});
  let output='',error='';child.stdout.on('data',v=>{output+=v;});child.stderr.on('data',v=>{error+=v;});child.on('error',reject);child.on('exit',code=>{if(code!==0)return reject(Error(error));try{done(JSON.parse(output));}catch(e){reject(e);}});
  child.stdin.end(`select natori_case_admin_command_v1('${owner}','${id}','${project}','retry-notice','${current.revision}','${input}'::jsonb,'{"kind":"shared-key"}'::jsonb)`);
 })));
 check('two different concurrent operations for an old exact failed target queue only one new attempt and leave the other stale/review-blocked',()=>{
  assert.equal(concurrent.filter(v=>v.result==='queued').length,1);
  assert(concurrent.filter(v=>v.result!=='queued').every(v=>['stale','notice_review'].includes(v.result)));
  assert.equal(sql(`select count(*) from natori_notification_jobs where notification_key='continuity/${project}/parallel'`),'2');
  assert.equal(sql(`select count(*) from natori_case_admin_operations where id in ('${operations[0]}','${operations[1]}')`),'1');
 });
 check('new target read RPCs are invoker empty-path service-only; no PUBLIC implicit execute',()=>{
  assert.equal(sql(`select bool_and(not prosecdef and proconfig=ARRAY['search_path=""']::text[] and not has_function_privilege('anon',oid,'execute') and not has_function_privilege('authenticated',oid,'execute') and has_function_privilege('service_role',oid,'execute')) from pg_proc where proname in ('natori_case_admin_notice_read_v1','natori_case_reconciliation_notice_read_v1')`),'t');
 });
}
