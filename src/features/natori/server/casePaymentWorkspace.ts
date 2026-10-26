import "server-only";
import { isDeepStrictEqual } from "node:util";
import { randomUUID,createHash } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Json } from "@/types/supabase";
import { resolveNatoriOwnerId } from "./natoriOwner";
import { caseWorkspaceReadAvailable } from "./caseWorkspaceRead";
import { executePaymentLinkOperation,paymentLinkResultSchema,paymentLinkMailGate,paymentPayload,type PaymentLinkRpc } from "./paymentLinkService";
import { dispatchAcceptanceNotification,buildAcceptanceNotificationPayload } from "./acceptanceNotifications";
import { sealDeliveryNotification,openDeliveryNotification } from "./deliveryNotificationPayload";
import { buildGenerationPaymentMail,paymentLinkRequestSchema } from "../lib/paymentLinkRequest";
import { alignPaymentDeadlineToStopRun } from "../lib/paymentDeadline";
import { caseNoMailAcceptanceEnabled } from "./caseNoMailAcceptance";
import { acceptanceContext } from "./caseAcceptance";
import { casePaymentCommandSchema,type CasePaymentView,type CasePaymentPreview } from "../lib/casePaymentWorkspace";
import { currentNatoriFlow } from "./caseCurrentFlow";
import { readCurrentPayment,commandCurrentPayment } from "./caseCurrentPayment";

const timestamp=z.string().refine(v=>Number.isFinite(Date.parse(v)));
const quote=z.object({id:z.uuid(),version:z.number().int(),amount:z.number().int(),acceptedAt:timestamp.nullable(),supersededAt:timestamp.nullable()});
const job=z.object({id:z.uuid(),notification_key:z.string(),attempt_no:z.number(),status:z.string(),sent_at:timestamp.nullable(),created_at:timestamp,send_started_at:timestamp.nullable(),lease_expires_at:timestamp.nullable(),quote_id:z.uuid().nullable(),snapshot:z.record(z.string(),z.unknown()),payload:z.unknown()});
const snapshot=z.object({project:z.object({id:z.uuid(),owner:z.uuid(),title:z.string(),clientName:z.string(),email:z.string().nullable(),status:z.string(),acceptedAmount:z.number().nullable(),acceptedAt:timestamp.nullable(),paidAt:timestamp.nullable(),deletedAt:timestamp.nullable(),legacyLink:z.string().nullable()}),quote:quote.nullable(),link:z.object({id:z.uuid(),quoteId:z.uuid(),generation:z.number(),revision:z.number(),deadline:timestamp,state:z.string(),url:z.string().nullable(),amount:z.number()}).nullable(),jobs:z.array(job).max(101),noticeGuards:z.record(z.string(),z.unknown()),legacyCount:z.number(),review:z.boolean(),pending:z.boolean(),operation:z.object({id:z.uuid(),status:z.string(),request:z.unknown(),guard:z.unknown(),notificationId:z.uuid().nullable(),retirementReason:z.string().nullable()}).nullable(),rejection:z.string().nullable()});
type Snapshot=z.infer<typeof snapshot>;
const envelope=z.object({purpose:z.literal("natori-case-payment-confirm-v1"),owner:z.uuid(),project:z.uuid(),operation:z.uuid(),validUntil:timestamp,guard:z.record(z.string(),z.unknown()),request:paymentLinkRequestSchema.optional(),retryId:z.uuid().optional(),resumeId:z.uuid().optional(),deadline:timestamp,mailConfiguration:z.string().regex(/^[a-f0-9]{64}$/)});
type Envelope=z.infer<typeof envelope>;
export function casePaymentEnabled(){
 try {
  const noMail=caseNoMailAcceptanceEnabled(true);
  return caseWorkspaceReadAvailable()&&process.env.NATORI_CASE_PAYMENT_WORKSPACE_ENABLED==="1"
   &&(currentNatoriFlow()||["NATORI_PAYMENT_LINK_INTEGRITY_ENABLED","NATORI_ACCEPTANCE_OUTBOX_ENABLED","NATORI_QUOTE_INTEGRITY_ENABLED","NATORI_PAYMENT_INTEGRITY_ENABLED"].every(k=>process.env[k]==="1"))
   &&(noMail||process.env.NATORI_NOTIFICATION_SENDING_ENABLED==="1");
 } catch { return false; }
}
const mailConfiguration=()=>createHash("sha256").update(JSON.stringify([process.env.NATORI_ORDER_MAIL_FROM??"",process.env.NATORI_PORTFOLIO_CONTACT_TO??"",process.env.NATORI_MAIL_BCC?.trim()??""])).digest("hex");
const encode=(value:Json)=>Buffer.from(JSON.stringify(value)).toString("base64url");
function decode(token:string){return JSON.parse(Buffer.from(token,"base64url").toString("utf8")) as Json;}
async function read(owner:string,project:string,operation?:string){
 const {data,error}=await supabaseAdmin().rpc("natori_case_payment_snapshot_v1",{p_owner_id:owner,p_project_id:project,...(operation?{p_operation_id:operation}:{})},{get:true});
 if(error)throw Error("read_unavailable");if(data===null)return null;
 const v=snapshot.parse(data);if(v.project.owner!==owner||v.project.id!==project)throw Error("scope_mismatch");return v;
}
function guard(v:Snapshot):Json {
 const {status:_s,paidAt:_p,deletedAt:_d,legacyLink:_l,...identity}=v.project;void _s;void _p;void _d;void _l;
 const {title,clientName,email,...facts}=identity;
 const metadataHash=createHash("sha256").update([title,clientName,email??""].map(s=>`${Buffer.byteLength(s,"utf8")}:${s}`).join("")).digest("hex");
 return {quote:v.quote,identity:{...facts,metadataHash},link:v.link,notices:v.jobs.map(j=>({id:j.id,status:j.status})).sort((a,b)=>a.id.localeCompare(b.id)),legacyCount:v.legacyCount} as Json;
}
function eligibility(v:Snapshot){
 const q=v.quote,p=v.project,a=v.link;
 if(p.paidAt)return "入金記録あり。支払案内は送信しません。";
 if(v.operation?.retirementReason)return "準備の再実行を停止しています。結果は未確定です。新しい案内は作らず、保存された操作・支払記録を照合してください。";
 const pendingGuard=v.operation?.status==="pending"?v.operation.guard as {link?:unknown}|null:null;
 if(pendingGuard?.link&&!isDeepStrictEqual(pendingGuard.link,v.link))return "確認時から支払リンク・期限の記録が変わりました。未完了の操作を照合してください。";
 if(!q?.acceptedAt||q.supersededAt||q.amount<50||p.acceptedAmount!==q.amount||!p.acceptedAt||!z.email().safeParse(p.email).success)return "対象見積の承諾・金額・宛先を確認してください。";
 if(p.deletedAt||!["quoted","awaiting_payment"].includes(p.status)||v.review)return "案件または入金の照合が必要です。";
 if(v.jobs.length>100||v.legacyCount>0)return "過去の案内記録を照合してください。この画面では新規送信しません。";
 if(a&&((a.state!=="active"&&!(v.pending&&a.state==="creating"))||a.quoteId!==q.id||a.amount!==q.amount||Date.parse(a.deadline)<=Date.now()+60000||(!a.url&&!v.pending)))return "既存リンクの状態・期限・見積を照合してください。再発行は行いません。";
 if(!a&&p.legacyLink)return "旧リンクの照合が必要です。";
 const currentGuard=guard(v) as {quote?:unknown;identity?:unknown};
 for(const j of v.jobs.filter(j=>j.status!=="sent")){
  const stored=v.noticeGuards[j.notification_key] as {quote?:unknown;identity?:unknown}|undefined;
  if(stored&&(!isDeepStrictEqual(stored.quote,currentGuard.quote)||!isDeepStrictEqual(stored.identity,currentGuard.identity)))return "確認時から見積・宛先の情報が変わりました。未解決の案内を照合してください。";
 }
 if(v.jobs.some(j=>j.quote_id!==q.id||!a||j.snapshot.attemptId!==a.id||j.snapshot.deadline!==a.deadline))return "案内と現行の見積・リンクの対応を照合してください。";
 return null;
}
function view(v:Snapshot):CasePaymentView {
 const blocked=eligibility(v),unresolved=v.jobs.filter(j=>j.status!=="sent"),failed=unresolved.length===1&&unresolved[0].status==="failed";
 const resumable=unresolved.length===1&&["pending","sending"].includes(unresolved[0].status)&&!unresolved[0].send_started_at&&(!unresolved[0].lease_expires_at||Date.parse(unresolved[0].lease_expires_at)<=Date.now());
 const retired=Boolean(v.operation?.retirementReason),pending=v.pending,unknown=unresolved.some(j=>j.status==="unknown"||(j.status==="sending"&&j.send_started_at&&(!j.lease_expires_at||Date.parse(j.lease_expires_at)<=Date.now()))),processing=unresolved.some(j=>["pending","sending"].includes(j.status));
 return {enabled:true,projectId:v.project.id,phase:v.project.paidAt?"paid":retired&&v.operation?.retirementReason?.endsWith("_unresolved")?"unknown":blocked?"blocked":pending?"processing":unknown?"unknown":processing?"processing":failed?"failed":v.jobs.length?"sent":"prepare",
  reason:blocked??(pending?"リンクの準備処理が未完了です。保存済みの同じ操作を確認してください。":unknown?"送信サービスの受付結果は不明です。照会だけを行い、新しい案内は送信しません。":processing?"送信ジョブ受付済み。送信成功・到達はまだ確認できません。":failed?"確定失敗の記録があります。同じ内容の再試行を確認できます。":v.jobs.length?"送信サービス受付済み。到達・既読・入金は別の記録です。":"見積承諾済み。支払案内は未送信です。"),
  quoteVersion:v.quote?.version??null,amount:v.quote?.amount??null,deadline:v.link?.deadline??null,recipient:v.project.email,sentCount:v.jobs.filter(j=>j.status==="sent").length,
  canPrepare:!blocked&&!pending&&!unresolved.length,canRetry:!blocked&&!pending&&failed&&unresolved[0].attempt_no<5,canResume:!blocked&&!pending&&resumable,
  operationId:v.operation?.id??null,operationState:v.rejection?"rejected":retired?"retired":v.operation?.status??null,receipt:v.operation?.status==="pending"&&!retired&&v.operation.request?encode(v.operation.request as Json):null,
  jobs:v.jobs.map(j=>({id:j.id,status:j.status,attempt:j.attempt_no,sentAt:j.sent_at}))};
}
export async function readCasePayment(project:string,operation?:string){if(currentNatoriFlow())return readCurrentPayment(project,operation);const v=await read(await resolveNatoriOwnerId(),project,operation);return v?view(v):null;}
const rawCommand=async(owner:string,project:string,command:string,input:Json)=>{
 const {data,error}=await supabaseAdmin().rpc("natori_case_payment_command_v1",{p_owner_id:owner,p_project_id:project,p_command:command,p_input:input});
 if(error)throw Error("command_unavailable");return z.object({result:z.string(),notificationId:z.uuid().nullish()}).passthrough().parse(data);
};
function scopedRpc(e:Envelope,receipt:Json):PaymentLinkRpc{return async(owner,project,command,input={})=>{
 if(owner!==e.owner||project!==e.project)throw Error("scope_mismatch");
 const values=input as Record<string,Json>;
 const data=await rawCommand(owner,project!,command,{...values,...(command==="finish"&&values.payload?{payload:{...(values.payload as Record<string,Json>),workspace:"natori-case-payment-v1"}}:{}),guard:e.guard as Json,receipt});
 // Reuse the writer's result validation; the wrapper deliberately has the same contract.
 return paymentLinkResultSchema.parse(data);
};}
/** Marker is immutable with the encrypted payload, including retries through older UIs/Cron. */
export async function casePaymentMailGate(project:string,id:string,token:string,release=false){
 const call:PaymentLinkRpc=async(owner,target,command,input={})=>{if(target!==project||!["mail_gate","context"].includes(command))throw Error("scope_mismatch");return paymentLinkResultSchema.parse(await rawCommand(owner,project,command,input));};
 return paymentLinkMailGate(project,id,token,release,call);
}
async function dispatch(id:string,e:Envelope,receipt:Json,manual=false){
 const gate=(project:string,job:string,token:string,release=false)=>paymentLinkMailGate(project,job,token,release,scopedRpc(e,receipt));
 await dispatchAcceptanceNotification(id,manual,undefined,gate);
}
export async function commandCasePayment(value:unknown){
 if(currentNatoriFlow())return commandCurrentPayment(value);
 const c=casePaymentCommandSchema.parse(value),owner=await resolveNatoriOwnerId();
 if(caseNoMailAcceptanceEnabled())await acceptanceContext(owner,c.projectId,true);
 if(c.action==="prepare"){
  const v=await read(owner,c.projectId);if(!v)return {result:"not_found"};const state=view(v);
  if(c.retry&&c.resume)return {result:"invalid_request"};
  if(c.retry?!state.canRetry:c.resume?!state.canResume:!state.canPrepare)return {result:"blocked",view:state};
  const operation=randomUUID(),kind=c.retry?"retry":c.resume?"resume":v.jobs.length?"resend":"initial";
  const deadline=v.link?.deadline??(c.deadline?alignPaymentDeadlineToStopRun(c.deadline):null);
  if(!deadline||Date.parse(deadline)<=Date.now()+60000||Date.parse(deadline)>Date.now()+366*86400000)return {result:"invalid_deadline"};
  const validUntil=new Date(Date.now()+10*60000).toISOString(),q=v.quote!;
  const e:Envelope={purpose:"natori-case-payment-confirm-v1",owner,project:c.projectId,operation,validUntil,deadline,mailConfiguration:mailConfiguration(),guard:guard(v) as Envelope["guard"]};
  let payload;
  if(c.retry||c.resume){const frozen=v.jobs.find(j=>j.status!=="sent")!;if(c.retry)e.retryId=frozen.id;else e.resumeId=frozen.id;payload=buildAcceptanceNotificationPayload({purpose:"payment_link_client",payload:frozen.payload as Json,snapshot:frozen.snapshot as Json});}
  else{const mail=buildGenerationPaymentMail(v.project.clientName,v.project.title,q.amount);e.request=paymentLinkRequestSchema.parse({projectId:c.projectId,operationId:operation,action:v.link?"renotify":"issue",...(v.link?{revision:v.link.revision}:{deadline}),to:v.project.email,...mail});
   payload=buildAcceptanceNotificationPayload({purpose:"payment_link_client",snapshot:{},payload:paymentPayload(e.request,v.link?.url??"{発行後の支払リンク}",deadline)});}
  const token=encode(sealDeliveryNotification(e,deadline));
  const preview:CasePaymentPreview={projectId:c.projectId,projectTitle:v.project.title,operationId:operation,kind,quoteVersion:q.version,amount:q.amount,deadline,to:payload.to,from:payload.from,replyTo:payload.reply_to,bcc:payload.bcc??[],subject:payload.subject,text:payload.text,linkPending:!v.link,validUntil,token};
  return {result:"prepared",preview};
 }
 const receipt=decode(c.token),e=envelope.parse(openDeliveryNotification(receipt));
 if(e.owner!==owner||e.project!==c.projectId||e.operation!==c.operationId)return {result:"conflict"};
 const current=await read(owner,e.project,e.operation);if(!current)return {result:"not_found"};
 if(current.rejection)return {result:"rejected",view:view(current)};
 if(current.operation?.status==="completed")return {result:"completed",view:view(current)}; // Pure recovery, never redispatch.
 if(current.operation?.retirementReason)return {result:"receipt_retired",view:view(current)};
 if(current.operation?.status==="pending"&&e.guard.link&&!isDeepStrictEqual(e.guard.link,current.link))return {result:"confirmation_stale",view:view(current)};
 if(!current.operation&&Date.parse(e.validUntil)<=Date.now())return {result:"confirmation_expired",view:view(current)};
 if(e.retryId||e.resumeId){
  const done=await rawCommand(owner,e.project,e.resumeId?"resume":"retry",{jobId:e.resumeId??e.retryId!,guard:e.guard as Json});
  if(done.result==="queued"&&done.notificationId)await dispatch(done.notificationId,e,receipt,true);
  return {result:done.result,view:await readCasePayment(e.project)};
 }
 if(e.mailConfiguration!==mailConfiguration())return {result:"configuration_changed",view:view(current)};
 if(!e.request||e.request.projectId!==e.project||e.request.operationId!==e.operation)return {result:"invalid_request"};
 const done=await executePaymentLinkOperation(e.request,undefined,{rpc:scopedRpc(e,receipt),dispatch:id=>dispatch(id,e,receipt)});
 return {result:done.result,view:await readCasePayment(e.project,e.operation)};
}
