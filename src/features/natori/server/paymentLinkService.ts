import "server-only";
import { createHash, randomUUID } from "node:crypto";
import Stripe from "stripe";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Json } from "@/types/supabase";
import { resolveNatoriOwnerId } from "./natoriOwner";
import { resolveTrustedNatoriOwnerId } from "./trustedNatoriOwner";
import { sealDeliveryNotification } from "./deliveryNotificationPayload";
import { buildAcceptanceNotificationPayload, dispatchAcceptanceNotification } from "./acceptanceNotifications";
import { injectPaymentLink } from "../lib/orderMail";

export const paymentLinkIntegrityEnabled = () => process.env.NATORI_PAYMENT_LINK_INTEGRITY_ENABLED === "1";
const uuid = z.uuid();
import {paymentLinkRequestSchema,paymentLinkStateSchema,type PaymentLinkRequest} from "../lib/paymentLinkRequest";
const attemptSchema=z.object({id:uuid,project_id:uuid,quote_id:uuid,generation:z.number().int(),amount:z.number().int(),livemode:z.boolean(),provider_account_id:z.string().regex(/^acct_[A-Za-z0-9]+$/).nullable(),
 state:z.string(),price_id:z.string().nullable(),link_id:z.string().nullable(),link_url:z.string().nullable(),deadline:z.string(),deadline_revision:z.number().int(),
 claim_generation:z.number().int(),price_started_at:z.string().nullable(),link_started_at:z.string().nullable()});
type Attempt=z.infer<typeof attemptSchema>;
const stopSchema=z.object({id:uuid,link_id:z.string(),livemode:z.boolean().nullable(),claim_generation:z.number().int()});
const resultSchema=z.object({result:z.string(),attempt:attemptSchema.nullish(),job:stopSchema.optional(),notificationId:uuid.nullish(),
 reason:z.string().nullish(),operationState:z.string().optional(),operationId:uuid.optional(),legacyLinkId:z.string().nullish(),legacyUrl:z.string().nullish(),quoteId:uuid.nullish(),projects:z.array(uuid).optional()}).passthrough();
async function rpc(owner:string,project:string|null,command:string,input:Json={}){
 const {data,error}=await supabaseAdmin().rpc("natori_payment_links_v1",{p_owner_id:owner,p_project_id:project,p_command:command,p_input:input});
 if(error)throw new Error("link_db_unavailable");return resultSchema.parse(data);
}
export type ProviderLink={id:string;url:string;active:boolean;livemode:boolean;projectId:string;quoteId:string;amount:number|null;currency:string|null;kind?:string;attemptId?:string;generation?:string;priceId?:string};
export type ProviderSession={id:string;status:string|null;paymentStatus:string};
/** Provider adapter injection is for sealed test fixtures; production always uses the SDK adapter. */
export type PaymentLinkProvider={
 accountId:()=>Promise<string>;
 createPrice:(attempt:Attempt,key:string)=>Promise<string>;
 createLink:(attempt:Attempt,priceId:string,key:string)=>Promise<ProviderLink>;
 readLink:(id:string)=>Promise<ProviderLink>;
 findLink:(attempt:Attempt,heartbeat:()=>Promise<void>)=>Promise<ProviderLink|null>;
 sessions:(id:string)=>Promise<ProviderSession[]>;
 expireSession:(id:string)=>Promise<void>;
 stopLink:(id:string)=>Promise<void>;
};
function mode():boolean{const value=process.env.NATORI_STRIPE_MODE;if(value!=="test"&&value!=="live")throw new Error("link_configuration");return value==="live";}
function provider():PaymentLinkProvider{
 if(!process.env.STRIPE_SECRET_KEY)throw new Error("link_configuration");
 const stripe=new Stripe(process.env.STRIPE_SECRET_KEY,{timeout:10000,maxNetworkRetries:0});
 const read=async(id:string):Promise<ProviderLink>=>{
  const link=await stripe.paymentLinks.retrieve(id),items=await stripe.paymentLinks.listLineItems(id,{limit:2});
  const item=items.data[0],price=item?.price;
  return {id:link.id,url:link.url,active:link.active,livemode:link.livemode,projectId:link.metadata.projectId??"",quoteId:link.metadata.quoteId??"",kind:link.metadata.kind,attemptId:link.metadata.attemptId,generation:link.metadata.generation,priceId:price?.id,
   amount:!items.has_more&&items.data.length===1&&item.quantity===1?price?.unit_amount??null:null,currency:price?.currency??null};
 };
 return {accountId:async()=>{const id=(await stripe.accounts.retrieve()).id;if(!/^acct_[A-Za-z0-9]+$/.test(id))throw new Error("link_configuration");return id;},readLink:read,
  findLink:async(a,heartbeat)=>{let after:string|undefined;let found:string|undefined;
   // A bounded complete scan is required: a second match on a later page is ambiguous.
   for(let page=0;page<10;page++){await heartbeat();const list=await stripe.paymentLinks.list({limit:100,...(after?{starting_after:after}:{})});
    for(const link of list.data){if(link.metadata.attemptId!==a.id)continue;
     if(found||link.metadata.kind!=="natori_commission"||link.metadata.projectId!==a.project_id||link.metadata.quoteId!==a.quote_id
      ||link.metadata.generation!==String(a.generation)||link.livemode!==a.livemode)throw new Error("reconciliation_unresolved");found=link.id;}
    if(!list.has_more){if(!found)return null;await heartbeat();const link=await read(found);await heartbeat();
     if(!verified(link,{...a,link_id:link.id,link_url:link.url},false,true))throw new Error("reconciliation_unverified");return link;}
    const next=list.data.at(-1)?.id;if(!next||next===after)break;after=next;
   }throw new Error("reconciliation_incomplete");},
  createPrice:async(a,key)=>(await stripe.prices.create({currency:"jpy",unit_amount:a.amount,product_data:{name:"Natori commission"},metadata:{attemptId:a.id}}, {idempotencyKey:key})).id,
  createLink:async(a,price,key)=>{const link=await stripe.paymentLinks.create({line_items:[{price,quantity:1}],payment_method_types:["card"],
   metadata:{kind:"natori_commission",projectId:a.project_id,quoteId:a.quote_id,attemptId:a.id,generation:String(a.generation)},
   restrictions:{completed_sessions:{limit:1}}},{idempotencyKey:key});return {id:link.id,url:link.url,active:link.active,livemode:link.livemode,projectId:link.metadata.projectId??"",quoteId:link.metadata.quoteId??"",kind:link.metadata.kind,attemptId:link.metadata.attemptId,generation:link.metadata.generation,priceId:price,amount:a.amount,currency:"jpy"};},
  sessions:async id=>{const all:ProviderSession[]=[];let after:string|undefined;for(let page=0;page<10;page++){
   const sessions=await stripe.checkout.sessions.list({payment_link:id,limit:100,...(after?{starting_after:after}:{})});
   all.push(...sessions.data.map(s=>({id:s.id,status:s.status,paymentStatus:s.payment_status})));
   if(!sessions.has_more)return all;after=sessions.data.at(-1)?.id;if(!after)break;
  }throw new Error("sessions_unresolved");},
  expireSession:async id=>{await stripe.checkout.sessions.expire(id);},
  stopLink:async id=>{const stopped=await stripe.paymentLinks.update(id,{active:false});if(stopped.id!==id||stopped.active)throw new Error("provider_stop_unconfirmed");},
 };
}
function generationVerified(link:ProviderLink,a:Attempt){return link.kind==="natori_commission"&&link.attemptId===a.id&&link.generation===String(a.generation)
 &&(a.price_id===null||link.priceId===a.price_id);}
function verified(link:ProviderLink,a:Attempt,active=true,managed=a.price_id!==null){return link.id===a.link_id&&link.url===a.link_url&&link.livemode===a.livemode
 &&(!managed||generationVerified(link,a))&&link.projectId===a.project_id&&link.quoteId===a.quote_id&&link.amount===a.amount&&link.currency==="jpy"&&(!active||link.active);}
async function result(owner:string,input:PaymentLinkRequest,noticeId?:string|null){
 if(noticeId)await dispatchAcceptanceNotification(noticeId);
 const state=await getPaymentLinkState(input.projectId,owner);return {result:"completed",state};
}
export async function getPaymentLinkState(projectId:string,owner?:string){
 const response=await rpc(owner??await resolveNatoriOwnerId(),projectId,"read");
 return paymentLinkStateSchema.parse(response);
}
export async function getRejectedPaymentLinkOperation(projectId:string,operationId:string){
 const outcome=await rpc(await resolveNatoriOwnerId(),projectId,"rejection",{operationId});
 return outcome.result==="rejected"&&outcome.operationId===operationId
  ?{operationState:"rejected" as const,operationId,reason:outcome.reason}:{};
}
export type PaymentLinkState=Awaited<ReturnType<typeof getPaymentLinkState>>;

function paymentPayload(input:PaymentLinkRequest,url:string,deadline:string):Json{
 const displayed=new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",dateStyle:"medium",timeStyle:"short"}).format(new Date(deadline));
 const payload={from:process.env.NATORI_ORDER_MAIL_FROM??"",to:[input.to!],reply_to:process.env.NATORI_PORTFOLIO_CONTACT_TO??"",
  ...(process.env.NATORI_MAIL_BCC?.trim()?{bcc:[process.env.NATORI_MAIL_BCC.trim()]}:{}),subject:input.subject!,
  text:injectPaymentLink(input.body!,url)+`\n\n支払期限: ${displayed}（日本時間）\n再通知で期限は延長されません。お問い合わせはこのメールへの返信でご連絡ください。`,
  headers:{"X-Natori-Notification":"payment_link_client"}};
 const sealed=sealDeliveryNotification(payload,deadline);
 buildAcceptanceNotificationPayload({purpose:"payment_link_client",snapshot:{},payload:sealed});return sealed;
}

export async function executePaymentLinkOperation(value:unknown,injectedProvider?:PaymentLinkProvider){
 if(!paymentLinkIntegrityEnabled()||process.env.NATORI_ACCEPTANCE_OUTBOX_ENABLED!=="1"||process.env.NATORI_QUOTE_INTEGRITY_ENABLED!=="1"||process.env.NATORI_PAYMENT_INTEGRITY_ENABLED!=="1")return {result:"not_configured"};
 const parsed=paymentLinkRequestSchema.safeParse(value);if(!parsed.success)return {result:"invalid_request"};
 const input=parsed.data,owner=await resolveNatoriOwnerId(),token=randomUUID();
 const requestHash=createHash("sha256").update(JSON.stringify(input)).digest("hex");
 let claimed:Awaited<ReturnType<typeof rpc>>|undefined;
 try{
  // Inspect the old provider object before any new generation. Stop old open Checkout
  // sessions so a stale browser cannot silently pay a newly retired generation.
  const recovery=await rpc(owner,input.projectId,"operation",{operationId:input.operationId,hash:requestHash});
  if(recovery.result==="completed")return result(owner,input,recovery.notificationId);
  if(recovery.result==="rejected"&&recovery.operationId===input.operationId)return {result:recovery.reason??"invalid_state",operationState:"rejected",operationId:input.operationId};
  if(recovery.result==="conflict")return {result:"conflict"};
  const live=mode(),external=injectedProvider??provider(),providerAccountId=await external.accountId();
  if(!/^acct_[A-Za-z0-9]+$/.test(providerAccountId))throw new Error("link_configuration");
  const context=await rpc(owner,input.projectId,"context");
  if(context.attempt&&(context.attempt.provider_account_id!==providerAccountId||context.attempt.livemode!==live))return {result:"needs_review"};
  if(["issue","renotify","reissue"].includes(input.action))paymentPayload(input,"https://buy.stripe.com/configuration-check",new Date(Date.now()+3600000).toISOString());
  if(input.action==="reissue"&&context.attempt?.state==="inactive"&&context.attempt.link_id){
   const old=await external.readLink(context.attempt.link_id);
   if(!verified(old,context.attempt,false)||old.active)return {result:"needs_review"};
   const sessions=await external.sessions(old.id);if(sessions.some(s=>s.status==="complete"||s.paymentStatus==="paid"))return {result:"payment_review"};
   for(const session of sessions.filter(s=>s.status==="open"))await external.expireSession(session.id);
  }
  const beginInput:Record<string,Json>={operationId:input.operationId,token,hash:requestHash,action:input.action,livemode:live,providerAccountId,
   deadline:input.deadline??null,revision:input.revision??null,confirmed:input.confirmed??false};
  if(input.action==="adopt"){
   if(!context.legacyLinkId||!context.legacyUrl||!context.quoteId)return {result:"legacy_review"};
   const old=await external.readLink(context.legacyLinkId),sessions=await external.sessions(old.id);
   if(old.id!==context.legacyLinkId||old.url!==context.legacyUrl||old.projectId!==input.projectId||old.quoteId!==context.quoteId||old.livemode!==live
    ||old.currency!=="jpy"||sessions.some(s=>s.status==="complete"||s.paymentStatus==="paid"))return {result:"payment_review"};
   const view=await getPaymentLinkState(input.projectId,owner);if(old.amount!==view.amount)return {result:"needs_review"};
   Object.assign(beginInput,{linkId:old.id,url:old.url,active:old.active,reconciled:true});
  }
  claimed=await rpc(owner,input.projectId,"begin",beginInput);
  if(claimed.result==="completed")return result(owner,input,claimed.notificationId);
  if(claimed.result!=="claimed"||!claimed.attempt)return {result:claimed.result,
   ...(claimed.operationState==="rejected"&&claimed.operationId===input.operationId?{operationState:"rejected",operationId:input.operationId}:{})};
  let a=claimed.attempt;
  if(a.provider_account_id!==providerAccountId||a.livemode!==live)return {result:"needs_review"};
  const stage=async(name:string,value:Json={},reason?:string)=>{
   const saved=await rpc(owner,input.projectId,"stage",{operationId:input.operationId,token,generation:a.claim_generation,stage:name,value,...(reason?{reason}:{})});
   if(saved.result!=="saved"||!saved.attempt)throw new Error("link_save_unconfirmed");a=saved.attempt;
  };
  if(a.state==="creating"){
   const key=`natori-plink/${a.id}`;
   if(!a.price_id){await stage("price_start");const id=await external.createPrice(a,key+"/price");await stage("price",{id});}
   if(!a.link_id){await stage("link_start");const link=await external.createLink(a,a.price_id!,key+"/link");
    if(link.livemode!==live||!generationVerified(link,a)||link.projectId!==a.project_id||link.quoteId!==a.quote_id||link.amount!==a.amount||link.currency!=="jpy"){
     await stage("review",{},"provider_creation_identity_mismatch");return {result:"needs_review"};}
    await stage("link",{id:link.id,url:link.url});}
  }
  if(!a.link_id)return {result:"needs_review"};
  const link=await external.readLink(a.link_id);
  if(!verified(link,a)){await stage("review",{},"provider_link_unverified");return {result:"needs_review"};}
  const finish:Record<string,Json>={operationId:input.operationId,token,generation:a.claim_generation,verified:true};
  if(input.action!=="extend"){
   finish.payload=paymentPayload(input,a.link_url!,a.deadline);
  }
  const done=await rpc(owner,input.projectId,"finish",finish);
  if(done.result!=="completed")return {result:done.result};
  return result(owner,input,done.notificationId);
 }catch{
  // No destructive unlock or new key. Exact frozen operation recovers its lease and IDs.
  return {result:claimed?.result==="claimed"?"retry_same_operation":"temporarily_unavailable"};
 }
}

export async function stopDuePaymentLinks(injectedProvider?:PaymentLinkProvider){
 const owner=resolveTrustedNatoriOwnerId();if(owner.kind!=="ok"||!paymentLinkIntegrityEnabled())return {kind:"not-configured" as const};
 try{const external=injectedProvider??provider(),live=mode(),providerAccountId=await external.accountId(),scan=await rpc(owner.ownerId,null,"scan");let expired=0,skipped=0,failed=0;
  if(!/^acct_[A-Za-z0-9]+$/.test(providerAccountId))throw new Error("link_configuration");
  for(const id of scan.projects??[]){
   const context=await rpc(owner.ownerId,id,"context");
   if(context.attempt&&!context.attempt.link_id){const token=randomUUID(),claim=await rpc(owner.ownerId,id,"reconcile_claim",{token,providerAccountId});
    if(claim.result!=="claimed"||!claim.attempt){skipped++;continue;}const a=claim.attempt;
    const fence={token,generation:a.claim_generation,providerAccountId};
    try{if(a.provider_account_id!==providerAccountId||a.livemode!==live)throw new Error("provider_account_unverified");
     const heartbeat=async()=>{if((await rpc(owner.ownerId,id,"reconcile_renew",fence)).result!=="renewed")throw new Error("reconciliation_stale");};
     const link=await external.findLink(a,heartbeat);
     if(!link||!verified(link,{...a,link_id:link.id,link_url:link.url},false,true))throw new Error("reconciliation_unverified");
     await heartbeat();
     if((await rpc(owner.ownerId,id,"reconcile_save",{...fence,linkId:link.id,url:link.url,verified:true})).result!=="saved"){skipped++;continue;}
    }catch{await rpc(owner.ownerId,id,"reconcile_review",fence);failed++;continue;}
   }
   await rpc(owner.ownerId,id,"queue_stop");const token=randomUUID(),claim=await rpc(owner.ownerId,id,"claim_stop",{token,providerAccountId});
   if(claim.result!=="claimed"||!claim.job){skipped++;continue;}const job=claim.job;
   const fence={token,jobId:job.id,generation:job.claim_generation,providerAccountId};
   const heartbeat=async()=>{if((await rpc(owner.ownerId,id,"stop_renew",fence)).result!=="renewed")throw new Error("stop_stale");};
   let outcome:"inactive"|"retry"|"review"="retry";
   try{
    // An old unpinned source or a switched account cannot prove provider inactivity.
    if(!claim.attempt||claim.attempt.provider_account_id!==providerAccountId||claim.attempt.livemode!==live)outcome="review";
    else{await heartbeat();const link=await external.readLink(job.link_id);
     if(link.id!==job.link_id||link.projectId!==id||link.livemode!==live||(job.livemode!==null&&job.livemode!==live)
      ||!verified(link,claim.attempt,false))outcome="review";
     else{await heartbeat();await external.stopLink(job.link_id);await heartbeat();
      const stopped=await external.readLink(job.link_id);
      outcome=verified(stopped,claim.attempt,false)&&!stopped.active?"inactive":"review";}}
   }catch(e){if((e as {code?:string}).code==="resource_missing")outcome="review";}
   const done=await rpc(owner.ownerId,id,"finish_stop",{...fence,outcome});
   if(done.result==="completed")expired++;else failed++;
  }return {kind:"ok" as const,scanned:scan.projects?.length??0,expired,skipped,failed};
 }catch{return {kind:"db-error" as const};}
}

export async function paymentLinkMailGate(projectId:string,jobId:string,token:string,release=false){
 const owner=resolveTrustedNatoriOwnerId();if(owner.kind!=="ok")return false;
 if(release){await rpc(owner.ownerId,projectId,"mail_gate",{jobId,token,action:"release"});return true;}
 const gate=await rpc(owner.ownerId,projectId,"mail_gate",{jobId,token});if(gate.result!=="allowed")return false;
 try{const context=await rpc(owner.ownerId,projectId,"context"),a=context.attempt,external=provider();
  if(!a?.link_id||a.provider_account_id!==await external.accountId()||a.livemode!==mode()||!verified(await external.readLink(a.link_id),a)){
   await rpc(owner.ownerId,projectId,"mail_gate",{jobId,token,action:"review"});return false;}
  return (await rpc(owner.ownerId,projectId,"mail_gate",{jobId,token})).result==="allowed";
 }catch{await rpc(owner.ownerId,projectId,"mail_gate",{jobId,token,action:"release"});return false;}
}
export async function closeOrArchiveWithPaymentGuard(projectId:string,action:"close"|"archive",reason=""){
 try{return (await rpc(await resolveNatoriOwnerId(),projectId,action,{reason})).result;}catch{return "db_error";}
}
