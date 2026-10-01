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
const attemptSchema=z.object({id:uuid,project_id:uuid,quote_id:uuid,generation:z.number().int(),amount:z.number().int(),livemode:z.boolean(),
 state:z.string(),price_id:z.string().nullable(),link_id:z.string().nullable(),link_url:z.string().nullable(),deadline:z.string(),deadline_revision:z.number().int(),
 claim_generation:z.number().int(),price_started_at:z.string().nullable(),link_started_at:z.string().nullable()});
type Attempt=z.infer<typeof attemptSchema>;
const stopSchema=z.object({id:uuid,link_id:z.string(),livemode:z.boolean().nullable(),claim_generation:z.number().int()});
const resultSchema=z.object({result:z.string(),attempt:attemptSchema.nullish(),job:stopSchema.optional(),notificationId:uuid.nullish(),
 legacyLinkId:z.string().nullish(),legacyUrl:z.string().nullish(),quoteId:uuid.nullish(),projects:z.array(uuid).optional()}).passthrough();
async function rpc(owner:string,project:string|null,command:string,input:Json={}){
 const {data,error}=await supabaseAdmin().rpc("natori_payment_links_v1",{p_owner_id:owner,p_project_id:project,p_command:command,p_input:input});
 if(error)throw new Error("link_db_unavailable");return resultSchema.parse(data);
}
export type ProviderLink={id:string;url:string;active:boolean;livemode:boolean;projectId:string;quoteId:string;amount:number|null;currency:string|null};
export type ProviderSession={id:string;status:string|null;paymentStatus:string};
/** Provider adapter injection is for sealed test fixtures; production always uses the SDK adapter. */
export type PaymentLinkProvider={
 createPrice:(attempt:Attempt,key:string)=>Promise<string>;
 createLink:(attempt:Attempt,priceId:string,key:string)=>Promise<ProviderLink>;
 readLink:(id:string)=>Promise<ProviderLink>;
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
  return {id:link.id,url:link.url,active:link.active,livemode:link.livemode,projectId:link.metadata.projectId??"",quoteId:link.metadata.quoteId??"",
   amount:!items.has_more&&items.data.length===1&&item.quantity===1?price?.unit_amount??null:null,currency:price?.currency??null};
 };
 return {readLink:read,
  createPrice:async(a,key)=>(await stripe.prices.create({currency:"jpy",unit_amount:a.amount,product_data:{name:"Natori commission"},metadata:{attemptId:a.id}}, {idempotencyKey:key})).id,
  createLink:async(a,price,key)=>{const link=await stripe.paymentLinks.create({line_items:[{price,quantity:1}],payment_method_types:["card"],
   metadata:{kind:"natori_commission",projectId:a.project_id,quoteId:a.quote_id,attemptId:a.id,generation:String(a.generation)},
   restrictions:{completed_sessions:{limit:1}}},{idempotencyKey:key});return {id:link.id,url:link.url,active:link.active,livemode:link.livemode,projectId:a.project_id,quoteId:a.quote_id,amount:a.amount,currency:"jpy"};},
  sessions:async id=>{const all:ProviderSession[]=[];let after:string|undefined;for(let page=0;page<10;page++){
   const sessions=await stripe.checkout.sessions.list({payment_link:id,limit:100,...(after?{starting_after:after}:{})});
   all.push(...sessions.data.map(s=>({id:s.id,status:s.status,paymentStatus:s.payment_status})));
   if(!sessions.has_more)return all;after=sessions.data.at(-1)?.id;if(!after)break;
  }throw new Error("sessions_unresolved");},
  expireSession:async id=>{await stripe.checkout.sessions.expire(id);},
  stopLink:async id=>{try{await stripe.paymentLinks.update(id,{active:false});}catch(e){if((e as {code?:string}).code!=="resource_missing")throw e;}},
 };
}
function verified(link:ProviderLink,a:Attempt,active=true){return link.id===a.link_id&&link.url===a.link_url&&link.livemode===a.livemode
 &&link.projectId===a.project_id&&link.quoteId===a.quote_id&&link.amount===a.amount&&link.currency==="jpy"&&(!active||link.active);}
async function result(owner:string,input:PaymentLinkRequest,noticeId?:string|null){
 if(noticeId)await dispatchAcceptanceNotification(noticeId);
 const state=await getPaymentLinkState(input.projectId,owner);return {result:"completed",state};
}
export async function getPaymentLinkState(projectId:string,owner?:string){
 const response=await rpc(owner??await resolveNatoriOwnerId(),projectId,"read");
 return paymentLinkStateSchema.parse(response);
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
  const live=mode(),external=injectedProvider??provider();
  // Inspect the old provider object before any new generation. Stop old open Checkout
  // sessions so a stale browser cannot silently pay a newly retired generation.
  const recovery=await rpc(owner,input.projectId,"operation",{operationId:input.operationId,hash:requestHash});
  if(recovery.result==="completed")return result(owner,input,recovery.notificationId);
  if(recovery.result==="conflict")return {result:"conflict"};
  const context=await rpc(owner,input.projectId,"context");
  if(["issue","renotify","reissue"].includes(input.action))paymentPayload(input,"https://buy.stripe.com/configuration-check",new Date(Date.now()+3600000).toISOString());
  if(input.action==="reissue"&&context.attempt?.state==="inactive"&&context.attempt.link_id){
   const old=await external.readLink(context.attempt.link_id);
   if(!verified(old,context.attempt,false)||old.active)return {result:"needs_review"};
   const sessions=await external.sessions(old.id);if(sessions.some(s=>s.status==="complete"||s.paymentStatus==="paid"))return {result:"payment_review"};
   for(const session of sessions.filter(s=>s.status==="open"))await external.expireSession(session.id);
  }
  const beginInput:Record<string,Json>={operationId:input.operationId,token,hash:requestHash,action:input.action,livemode:live,
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
  if(claimed.result!=="claimed"||!claimed.attempt)return {result:claimed.result};
  let a=claimed.attempt;
  const stage=async(name:string,value:Json={},reason?:string)=>{
   const saved=await rpc(owner,input.projectId,"stage",{operationId:input.operationId,token,generation:a.claim_generation,stage:name,value,...(reason?{reason}:{})});
   if(saved.result!=="saved"||!saved.attempt)throw new Error("link_save_unconfirmed");a=saved.attempt;
  };
  if(a.state==="creating"){
   const key=`natori-plink/${a.id}`;
   if(!a.price_id){await stage("price_start");const id=await external.createPrice(a,key+"/price");await stage("price",{id});}
   if(!a.link_id){await stage("link_start");const link=await external.createLink(a,a.price_id!,key+"/link");
    if(link.livemode!==live||link.projectId!==a.project_id||link.quoteId!==a.quote_id||link.amount!==a.amount||link.currency!=="jpy"){
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
 try{const external=injectedProvider??provider(),live=mode(),scan=await rpc(owner.ownerId,null,"scan");let expired=0,skipped=0,failed=0;
  for(const id of scan.projects??[]){await rpc(owner.ownerId,id,"queue_stop");const token=randomUUID(),claim=await rpc(owner.ownerId,id,"claim_stop",{token});
   if(claim.result!=="claimed"||!claim.job){skipped++;continue;}const job=claim.job;
   let outcome:"inactive"|"retry"|"review"="retry";
   try{const link=await external.readLink(job.link_id);
    if(link.id!==job.link_id||link.projectId!==id||link.livemode!==live||(job.livemode!==null&&job.livemode!==live))outcome="review";
    else{await external.stopLink(job.link_id);outcome="inactive";}
   }catch(e){if((e as {code?:string}).code==="resource_missing"&&job.livemode===live)outcome="inactive";}
   const done=await rpc(owner.ownerId,id,"finish_stop",{token,jobId:job.id,generation:job.claim_generation,outcome});
   if(done.result==="completed")expired++;else failed++;
  }return {kind:"ok" as const,scanned:scan.projects?.length??0,expired,skipped,failed};
 }catch{return {kind:"db-error" as const};}
}

export async function paymentLinkMailGate(projectId:string,jobId:string,token:string,release=false){
 const owner=resolveTrustedNatoriOwnerId();if(owner.kind!=="ok")return false;
 if(release){await rpc(owner.ownerId,projectId,"mail_gate",{jobId,token,action:"release"});return true;}
 const gate=await rpc(owner.ownerId,projectId,"mail_gate",{jobId,token});if(gate.result!=="allowed")return false;
 try{const context=await rpc(owner.ownerId,projectId,"context"),a=context.attempt;
  if(!a?.link_id||!verified(await provider().readLink(a.link_id),a)||a.livemode!==mode()){
   await rpc(owner.ownerId,projectId,"mail_gate",{jobId,token,action:"review"});return false;}
  return (await rpc(owner.ownerId,projectId,"mail_gate",{jobId,token})).result==="allowed";
 }catch{await rpc(owner.ownerId,projectId,"mail_gate",{jobId,token,action:"release"});return false;}
}
export async function closeOrArchiveWithPaymentGuard(projectId:string,action:"close"|"archive",reason=""){
 try{return (await rpc(await resolveNatoriOwnerId(),projectId,action,{reason})).result;}catch{return "db_error";}
}
