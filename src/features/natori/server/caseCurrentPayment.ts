import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Json } from "@/types/supabase";
import { resolveNatoriOwnerId } from "./natoriOwner";
import { currentFlowRpc, currentRequestHash, runCurrentOperation, readCurrentOperation } from "./caseCurrentFlow";
import { sendNatoriOrderMail } from "./orderMailService";
import { sealDeliveryNotification, openDeliveryNotification } from "./deliveryNotificationPayload";
import { buildPaymentMailDraft, injectPaymentLink, PAYMENT_DUE_DAYS } from "../lib/orderMail";
import { casePaymentCommandSchema, type CasePaymentView, type CasePaymentPreview } from "../lib/casePaymentWorkspace";

const policy = "sent_plus_7_days" as const;
const stateSchema = z.object({
  revision:z.string().regex(/^[a-f0-9]{64}$/), blocked:z.boolean(), complete:z.boolean(),
  project:z.object({id:z.uuid(),owner:z.uuid(),title:z.string(),clientName:z.string(),email:z.string().nullable(),status:z.string(),type:z.string(),deletedAt:z.string().nullable(),paidAt:z.string().nullable(),acceptedAt:z.string().nullable(),acceptedAmount:z.number().nullable(),link:z.string().nullable(),linkId:z.string().nullable(),linkQuote:z.string().nullable(),linkAmount:z.number().nullable(),linkStatus:z.string().nullable()}),
  quote:z.object({id:z.uuid(),version:z.number(),amount:z.number(),to:z.string(),acceptedAt:z.string().nullable(),supersededAt:z.string().nullable()}).nullable(),
  logs:z.array(z.object({id:z.uuid(),status:z.string(),sentAt:z.string().nullable(),sameLink:z.boolean(),quoteId:z.string().nullable(),amount:z.number()})),
});
type State=z.infer<typeof stateSchema>;
const envelope=z.object({purpose:z.literal("natori-current-payment-v1"),owner:z.uuid(),project:z.uuid(),id:z.uuid(),revision:z.string(),validUntil:z.string(),configuration:z.string(),quote:z.uuid(),amount:z.number(),to:z.string(),subject:z.string(),body:z.string()});
const mailConfiguration=()=>({from:process.env.NATORI_ORDER_MAIL_FROM??"ナトリ（me-ish） <noreply@me-ish.art>",replyTo:process.env.NATORI_PORTFOLIO_CONTACT_TO??"natori.o0716@gmail.com",bcc:process.env.NATORI_MAIL_BCC?.trim()?[process.env.NATORI_MAIL_BCC.trim()]:[]});
async function read(owner:string,project:string){
  const raw=await currentFlowRpc("natori_case_current_payment_v1",{p_owner:owner,p_project:project},true);
  if(raw===null)return null;const s=stateSchema.parse(raw);
  if(s.project.id!==project||s.project.owner!==owner)throw Error("current_payment_scope_mismatch");return s;
}
function eligible(s:State){
  const p=s.project,q=s.quote;
  return s.complete&&!s.blocked&&!p.deletedAt&&!p.paidAt&&p.linkStatus!=="paid"&&p.type!=="undecided"
    &&["quoted","awaiting_payment"].includes(p.status)&&q!==null&&!q.supersededAt&&q.acceptedAt!==null
    &&p.acceptedAt===q.acceptedAt&&p.acceptedAmount===q.amount&&q.amount>=50&&p.email===q.to&&z.email().safeParse(p.email).success
    &&s.logs.every(l=>l.status==="sent"&&l.sentAt!==null);
}
export async function readCurrentPayment(project:string,operation?:string):Promise<CasePaymentView|null>{
  const owner=await resolveNatoriOwnerId(),s=await read(owner,project);if(!s)return null;
  const op=await readCurrentOperation(owner,project,operation,operation?undefined:"payment");
  if(op&&op.kind!=="payment")throw Error("current_payment_operation_mismatch");
  const unknown=op?.status==="running"||op?.status==="unknown"||s.logs.some(l=>l.status!=="sent"||!l.sentAt);
  const sent=s.logs.filter(l=>l.status==="sent"&&l.sentAt),sameLink=sent.filter(l=>l.sameLink&&l.quoteId===s.quote?.id&&l.amount===s.quote.amount);
  const last=sameLink.map(l=>Date.parse(l.sentAt!)).sort((a,b)=>b-a)[0];
  const can=eligible(s)&&!unknown;
  return {enabled:true,projectId:project,deadlinePolicy:policy,phase:s.project.paidAt?"paid":unknown?"unknown":!can?"blocked":sent.length?"sent":"prepare",
    reason:s.project.paidAt?"入金記録あり。支払案内は送信しません。":unknown?"操作または送信結果が未確認です。新しい送信をせず、同じ操作の結果を照会してください。":!can?"見積・宛先・未解決の記録を確認してください。":sent.length?"送信サービス受付済み。再送に成功した日から支払期限が7日延長されます。":"見積承諾済み。送信に成功した日から支払期限を7日で自動設定します。",
    quoteVersion:s.quote?.version??null,amount:s.quote?.amount??null,deadline:Number.isFinite(last)?new Date(last+PAYMENT_DUE_DAYS*86400000).toISOString():null,
    recipient:s.project.email,sentCount:sent.length,canPrepare:can,canRetry:false,canResume:false,
    operationId:op?.id??null,operationState:op?.status??null,receipt:null,
    jobs:s.logs.map((l,i)=>({id:l.id,status:l.sentAt&&l.status==="sent"?"sent":"unknown",attempt:i+1,sentAt:l.sentAt}))};
}
export async function commandCurrentPayment(value:unknown){
  const c=casePaymentCommandSchema.parse(value),owner=await resolveNatoriOwnerId();
  if(c.action==="prepare"){
    if(c.deadline||c.retry||c.resume)return {result:"invalid_request"};
    const s=await read(owner,c.projectId),view=await readCurrentPayment(c.projectId);
    if(!s||!view)return {result:"not_found"};if(!view.canPrepare||!eligible(s))return {result:"blocked",view};
    const q=s.quote!,mail=buildPaymentMailDraft({clientName:s.project.clientName,title:s.project.title,amount:q.amount}),cfg=mailConfiguration();
    const reusable=s.project.linkQuote===q.id&&s.project.linkId&&s.project.link&&s.project.linkAmount===q.amount&&!["void","paid"].includes(s.project.linkStatus??"");
    const validUntil=new Date(Date.now()+600000).toISOString(),id=randomUUID();
    const e: z.infer<typeof envelope>={purpose:"natori-current-payment-v1",owner,project:c.projectId,id,revision:s.revision,validUntil,configuration:currentRequestHash(cfg),quote:q.id,amount:q.amount,to:q.to,...mail};
    const token=Buffer.from(JSON.stringify(sealDeliveryNotification(e,validUntil))).toString("base64url");
    const preview:CasePaymentPreview={projectId:c.projectId,projectTitle:s.project.title,operationId:id,kind:view.sentCount?"resend":"initial",quoteVersion:q.version,amount:q.amount,deadline:null,deadlinePolicy:policy,to:[q.to],...cfg,subject:mail.subject,text:injectPaymentLink(mail.body,reusable?s.project.link!:"{発行後の支払リンク}"),linkPending:!reusable,validUntil,token};
    return {result:"prepared",preview};
  }
  const e=envelope.parse(openDeliveryNotification(JSON.parse(Buffer.from(c.token,"base64url").toString("utf8")) as Json));
  if(e.owner!==owner||e.project!==c.projectId||e.id!==c.operationId)return {result:"conflict"};
  const existing=await readCurrentOperation(owner,c.projectId,e.id);
  if(existing)return {result:existing.status==="completed"?"completed":"result_unconfirmed",view:await readCurrentPayment(c.projectId,e.id)};
  if(Date.parse(e.validUntil)<=Date.now())return {result:"confirmation_expired"};
  if(e.configuration!==currentRequestHash(mailConfiguration()))return {result:"configuration_changed"};
  const result=await runCurrentOperation({owner,project:e.project,id:e.id,kind:"payment",revision:e.revision,request:e},()=>sendNatoriOrderMail({projectId:e.project,kind:"payment",operationId:e.id,to:e.to,amount:e.amount,subject:e.subject,body:e.body}));
  return {result:result.kind==="ok"?"completed":result.kind==="result-unconfirmed"?"result_unconfirmed":"blocked",view:await readCurrentPayment(e.project,e.id)};
}
