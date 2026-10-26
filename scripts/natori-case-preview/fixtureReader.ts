import { readCaseManagement } from '../../src/features/natori/server/caseManagementReader';
import { CASE_MANAGEMENT_SECTIONS, CASE_MANAGEMENT_SQL } from '../../src/features/natori/server/caseManagementQuery';
import { natoriManagementScope } from '../../src/features/natori/server/natoriManagementScope';
import type { CaseSourceProject } from '../../src/features/natori/server/caseSnapshotSource';
import type { CaseWorkspaceRecord } from '../../src/features/natori/types/caseWorkspace';

const OWNER='22222222-2222-4222-8222-222222222222';
export const PREVIEW_AS_OF='2026-10-20T05:20:00Z';
const created='2026-10-18T00:00:00Z', accepted='2026-10-19T00:00:00Z';
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
type Envelope={snapshot_id:string;observed_at:string;project:CaseSourceProject;sections:Record<string,unknown>};
type Row=Record<string,unknown>;
const rows=(...items:Row[])=>({total:items.length,rows:items});
function envelope(n:number):Envelope {
  return {snapshot_id:`fixture-snapshot-${n}`,observed_at:PREVIEW_AS_OF,project:{
    id:id(n),user_id:OWNER,status:'inquiry',type:'illustration',amount:40000,active_quote_id:null,
    quote_accepted_at:null,quote_accepted_amount:null,payment_confirmed_at:null,paid_amount:null,paid_at:null,
    delivery_accepted_at:null,completed_at:null,delivered_mail_at:null,has_legacy_payment_link:false,payment_link_status:null,
    deleted_at:null,created_at:created,updated_at:accepted,
  },sections:Object.fromEntries(CASE_MANAGEMENT_SECTIONS.map(name=>[name,rows()]))};
}
function quote(e:Envelope,n:number,agreed=true) {
  const qid=id(n+100);e.project.status='quoted';e.project.active_quote_id=qid;
  e.project.quote_accepted_at=agreed?accepted:null;e.project.quote_accepted_amount=agreed?40000:null;
  e.sections.financial_quotes=rows({id:qid,project_id:e.project.id,user_id:OWNER,version:2,amount:40000,
    expires_at:'2026-11-01T00:00:00Z',accepted_at:agreed?accepted:null,superseded_at:null,created_at:created,issued_at:created});
  return qid;
}
function paid(e:Envelope,n:number) {
  e.project.status='rough';e.project.payment_confirmed_at=accepted;e.project.paid_at=accepted;e.project.paid_amount=40000;
  e.sections.financial_payments=rows({id:id(n+200),project_id:e.project.id,quote_id:e.project.active_quote_id,
    amount:40000,status:'manual',received_at:accepted,currency:null,has_session:false,is_original:false,
    is_manual_candidate:true,amount_unavailable:false,has_refund_mapping:false});
}
function notice(e:Envelope,n:number,purpose:string,patch:Row={}) {
  return {id:id(n+300),project_id:e.project.id,quote_id:null,notification_key:`fixture-opaque-${n}`,attempt_no:1,purpose,
    status:'unknown',sent_at:null,created_at:'2026-10-19T01:00:00Z',updated_at:'2026-10-19T02:00:00Z',snapshot:{},
    release_id:null,release_expires_at:null,release_accepted_at:null,message_id:null,message_created_at:null,
    message_sender:null,message_operation_id:null,rough_id:null,rough_ok_at:null,...patch};
}
function released(e:Envelope,n:number,received=false) {
  paid(e,n);e.project.status=received?'completed':'delivered';
  if(received){e.project.delivery_accepted_at='2026-10-19T03:00:00Z';e.project.completed_at=e.project.delivery_accepted_at;}
  const rid=id(n+400),fid=id(n+500),expires='2026-11-01T00:00:00Z';
  e.sections.lifecycle_files=rows({id:fid,project_id:e.project.id,folder:'final',state:'ready',size_bytes:1024,
    storage_version:'fixture-version',verified_at:accepted,deleted_at:null,created_at:created,content_type_valid:true});
  e.sections.lifecycle_releases=rows({id:rid,project_id:e.project.id,revision:1,published_at:'2026-10-19T01:00:00Z',expires_at:expires,
    accepted_at:received?e.project.delivery_accepted_at:null,legacy:false,manifest_files:[{id:fid,size_bytes:1024,storage_version:'fixture-version'}],
    manifest_shape_valid:true,manifest_bindings_valid:true});
  const mail=notice(e,n,'delivery_issue_client',{release_id:rid,release_expires_at:expires,
    release_accepted_at:e.project.delivery_accepted_at,snapshot:{releaseId:rid}});
  e.sections.financial_notifications=rows(mail);
  e.sections.financial_delivery_operations=rows({id:id(n+600),project_id:e.project.id,release_id:rid,
    notification_id:mail.id,created_at:'2026-10-19T01:00:00Z',original_expires_at:expires,extension_expires_at:null,notification_key:mail.notification_key});
}
const descriptions=[
  ['森の表紙イラスト','依頼者A','2026-11-12'],['星の立ち絵','依頼者B','2026-10-20'],
  ['雲のアイコン','依頼者C','2026-10-23'],['小さな庭の挿絵','依頼者D','2026-10-20'],
  ['月のプロフィール画像','依頼者E','2026-10-25'],['雨上がりのラフ','依頼者F','2026-10-20'],
  ['窓辺のポスター','依頼者G','2026-10-24'],['光のカードイラスト','依頼者H','2026-10-20'],
] as const;
export function previewEnvelopes():Envelope[] {
  const all=descriptions.map((_,i)=>envelope(i+1));
  quote(all[0],1);
  released(all[1],2);
  paid(all[2],3);
  all[2].sections.lifecycle_tasks=rows(...['rough','lineart','coloring','delivery'].map((stage,i)=>({
    id:id(700+i),project_id:all[2].project.id,task_key:stage,stage,done:i===0,sort_order:i})));
  all[2].sections.lifecycle_consultation=rows({id:id(800),project_id:all[2].project.id,sender:'client',created_at:'2026-10-19T03:00:00Z'});
  paid(all[3],4);all[3].project.status='completed';all[3].project.delivery_accepted_at='2026-10-19T03:00:00Z';
  all[3].project.completed_at=all[3].project.delivery_accepted_at;all[3].project.delivered_mail_at=accepted;
  const qid=quote(all[4],5,false);
  all[4].sections.financial_notifications=rows(notice(all[4],5,'quote_issue_client',{quote_id:qid,snapshot:{version:2},status:'sent',sent_at:'2026-10-19T02:00:00Z'}));
  paid(all[5],6);all[5].sections.lifecycle_roughs=rows({id:id(900),project_id:all[5].project.id,message_id:id(901),
    before_quote:false,created_at:created,client_ok_at:accepted,message_bound:true});
  const paymentQuote=quote(all[6],7);const attempt=id(907);
  all[6].project.has_legacy_payment_link=true;all[6].project.payment_link_status='ready';
  all[6].sections.financial_links=rows({id:attempt,project_id:all[6].project.id,owner_id:OWNER,quote_id:paymentQuote,
    generation:1,amount:40000,state:'active',deadline:'2026-10-25T00:00:00Z',deadline_revision:1,created_at:accepted,
    updated_at:accepted,has_provider_link:true,is_project_link:true});
  all[6].sections.financial_notifications=rows(notice(all[6],7,'payment_link_client',{quote_id:paymentQuote,
    snapshot:{attemptId:attempt,generation:1,deadline:'2026-10-25T00:00:00Z'},status:'sent',sent_at:'2026-10-19T02:00:00Z'}));
  released(all[7],8,true);
  return all;
}
/** Executes only injected synthetic envelopes under the existing request-local owner scope. */
export async function buildPreviewRecords(mode:'normal'|'partial'='normal',data=previewEnvelopes()):Promise<CaseWorkspaceRecord[]> {
  if(mode==='partial')for(const e of data){
    e.snapshot_id+='-partial';e.observed_at='2026-10-20T05:25:00Z';
    e.sections.financial_payments={state:'unavailable',reason:'read_failed'};
    e.sections.lifecycle_extensions={state:'unavailable',reason:'read_failed'};
    e.sections.lifecycle_consultation={state:'unavailable',reason:'read_failed'};
  }
  return natoriManagementScope.run({ownerId:OWNER,operator:{kind:'shared-key',userId:null}},async()=>Promise.all(data.map(async(e,i)=>{
    const result=await readCaseManagement(e.project.id,async statement=>{
      if(statement.text!==CASE_MANAGEMENT_SQL||statement.values[0]!==e.project.id||statement.values[1]!==OWNER)throw new Error('Fixture scope mismatch');
      return {rows:[e]};
    });
    if(result.state!=='ready')throw new Error(`Synthetic reader failed: ${result.state}`);
    return {id:e.project.id,title:descriptions[i][0],clientLabel:descriptions[i][1],registeredDueDate:descriptions[i][2],model:result.model,display:result.display};
  })));
}
