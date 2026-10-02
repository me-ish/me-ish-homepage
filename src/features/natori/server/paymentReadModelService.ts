import "server-only";
import {supabaseAdmin} from "@/lib/supabaseAdmin";
import {resolveNatoriOwnerId} from "./natoriOwner";
import {resolveTrustedNatoriOwnerId} from "./trustedNatoriOwner";
import {paymentLinkIntegrityEnabled} from "./paymentLinkService";
import {paymentIntegrityEnabled} from "./paymentEventService";
import type {NatoriPaymentOverview,NatoriPaymentAttention} from "../types/payment";

const unavailable: NatoriPaymentOverview = {available:false,confirmedAt:null,requiresReview:false,processing:false};
/** Called after quote-capability validation; contains no Stripe ID, amount override or customer address. */
export async function getQuotePaymentOverview(projectId:string):Promise<NatoriPaymentOverview|undefined>{
 if(!paymentIntegrityEnabled())return undefined;
 const owner=resolveTrustedNatoriOwnerId();if(owner.kind!=="ok")return unavailable;
 const {data,error}=await supabaseAdmin().rpc("natori_quote_payment_state_v1",{p_owner_id:owner.ownerId,p_project_id:projectId});
 if(error||!data||typeof data!=="object"||Array.isArray(data))return unavailable;
 if(data.available!==true||typeof data.requiresReview!=="boolean"||typeof data.processing!=="boolean"
  ||(data.confirmedAt!==null&&typeof data.confirmedAt!=="string"))return unavailable;
 const overview:NatoriPaymentOverview={available:true,confirmedAt:data.confirmedAt,requiresReview:data.requiresReview,processing:data.processing};
 if(paymentLinkIntegrityEnabled()){
  const link=await supabaseAdmin().rpc("natori_payment_links_v1",{p_owner_id:owner.ownerId,p_project_id:projectId,p_command:"read"});
  if(link.error||!link.data||typeof link.data!=="object"||Array.isArray(link.data)||typeof link.data.state!=="string")return unavailable;
  overview.linkState=link.data.terminal===true?"terminal":link.data.state;
  overview.linkDeadline=typeof link.data.deadline==="string"?link.data.deadline:null;
  if(["needs_review","legacy_review"].includes(overview.linkState))overview.requiresReview=true;
 }
 return overview;
}

export async function getPaymentAttention():Promise<{available:boolean;items:NatoriPaymentAttention[]}|null>{
 if(!paymentIntegrityEnabled())return null;
 const owner=await resolveNatoriOwnerId();
 const {data,error}=await supabaseAdmin().rpc("natori_payment_attention_v1",{p_owner_id:owner});
 if(error||!Array.isArray(data))return {available:false,items:[]};
 const items:NatoriPaymentAttention[]=[];
 for(const value of data){
  if(!value||typeof value!=="object"||Array.isArray(value)||(value.projectId!==null&&typeof value.projectId!=="string")||typeof value.title!=="string"
   ||(value.status!=="processing"&&value.status!=="needs_review"&&value.status!=="pending")||(value.reason!==null&&typeof value.reason!=="string"))return {available:false,items:[]};
  items.push({projectId:value.projectId,title:value.title,status:value.status,reason:value.reason});
 }
 return {available:true,items};
}
