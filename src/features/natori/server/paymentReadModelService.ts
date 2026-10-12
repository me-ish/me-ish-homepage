import "server-only";
import {supabaseAdmin} from "@/lib/supabaseAdmin";
import {resolveNatoriOwnerId} from "./natoriOwner";
import {resolveTrustedNatoriOwnerId} from "./trustedNatoriOwner";
import {paymentLinkIntegrityEnabled} from "./paymentLinkService";
import {paymentIntegrityEnabled,refundLedgerReadEnabled} from "./paymentEventService";
import type {NatoriPaymentOverview,NatoriPaymentAttention} from "../types/payment";
import {isPaymentTimestamp,isStripePaymentUrl,PAYMENT_LINK_STATES} from "../lib/clientPayment";

const unavailable: NatoriPaymentOverview = {available:false,confirmedAt:null,requiresReview:false,processing:false};
/** Called after quote-capability validation; contains no Stripe ID, amount override or customer address. */
export async function getQuotePaymentOverview(projectId:string):Promise<NatoriPaymentOverview|undefined>{
 let overview:NatoriPaymentOverview|undefined;
 try{
  if(!paymentIntegrityEnabled())return undefined;
  const owner=resolveTrustedNatoriOwnerId();if(owner.kind!=="ok")return unavailable;
  const {data,error}=await supabaseAdmin().rpc("natori_quote_payment_state_v1",{p_owner_id:owner.ownerId,p_project_id:projectId});
  if(error!==null||!data||typeof data!=="object"||Array.isArray(data))return unavailable;
  if(data.available!==true||typeof data.requiresReview!=="boolean"||typeof data.processing!=="boolean"
   ||(data.confirmedAt!==null&&!isPaymentTimestamp(data.confirmedAt)))return unavailable;
  overview={available:true,confirmedAt:data.confirmedAt,requiresReview:data.requiresReview,processing:data.processing};
  if(paymentLinkIntegrityEnabled()){
   const link=await supabaseAdmin().rpc("natori_payment_links_v1",{p_owner_id:owner.ownerId,p_project_id:projectId,p_command:"read"});
   const value=link.data;
   if(link.error!==null||!value||typeof value!=="object"||Array.isArray(value)||value.result!=="ok"
    ||typeof value.state!=="string"||!PAYMENT_LINK_STATES.includes(value.state as typeof PAYMENT_LINK_STATES[number])
    ||typeof value.terminal!=="boolean"||(value.confirmedAt!==null&&!isPaymentTimestamp(value.confirmedAt)))return {...overview,available:false};
   // The link RPC reads the project later: payment may arrive between the two reads.
   overview.confirmedAt=value.confirmedAt??overview.confirmedAt;
   overview.linkState=value.terminal?"terminal":value.state;
   if(["needs_review","legacy_review"].includes(value.state))overview.requiresReview=true;
   if((value.deadline!==null&&!isPaymentTimestamp(value.deadline))||(value.url!==null&&!isStripePaymentUrl(value.url))
    ||(value.state==="active"&&(!isPaymentTimestamp(value.deadline)||!isStripePaymentUrl(value.url)
     ||typeof value.attemptId!=="string"||!value.attemptId||!Number.isSafeInteger(value.generation)||Number(value.generation)<1
     ||!Number.isSafeInteger(value.revision)||Number(value.revision)<1)))return {...overview,available:false};
   overview.linkDeadline=value.deadline;
   overview.linkUrl=value.url;
  }
  return overview;
 }catch(error){
  console.error("[natori-payment] overview unavailable",error instanceof Error?error.message:"unknown");
  return overview?{...overview,available:false}:unavailable;
 }
}

export async function getPaymentAttention():Promise<{available:boolean;items:NatoriPaymentAttention[]}|null>{
 if(!paymentIntegrityEnabled())return null;
 const owner=await resolveNatoriOwnerId();
 const rpc=refundLedgerReadEnabled()?"natori_payment_attention_v2":"natori_payment_attention_v1";
 const {data,error}=await supabaseAdmin().rpc(rpc,{p_owner_id:owner});
 if(error||!Array.isArray(data))return {available:false,items:[]};
 const items:NatoriPaymentAttention[]=[];
 for(const value of data){
  if(!value||typeof value!=="object"||Array.isArray(value)||(value.projectId!==null&&typeof value.projectId!=="string")||typeof value.title!=="string"
   ||(value.status!=="processing"&&value.status!=="needs_review"&&value.status!=="pending")||(value.reason!==null&&typeof value.reason!=="string"))return {available:false,items:[]};
  items.push({projectId:value.projectId,title:value.title,status:value.status,reason:value.reason});
 }
 return {available:true,items};
}
