import "server-only";
import {randomUUID} from "node:crypto";
import {supabaseAdmin} from "@/lib/supabaseAdmin";
import {resolveNatoriOwnerId} from "./natoriOwner";
import {resolveTrustedNatoriOwnerId} from "./trustedNatoriOwner";
import {paymentLinkIntegrityEnabled,stopDuePaymentLinks} from "./paymentLinkService";
import {paymentStopStatusSchema} from "../lib/paymentStopStatus";

export async function getPaymentStopStatus(){
 if(!paymentLinkIntegrityEnabled())return {enabled:false as const};
 const owner=await resolveNatoriOwnerId();
 const {data,error}=await supabaseAdmin().rpc("natori_payment_stop_status_v1",{p_owner_id:owner});
 if(error)throw new Error("payment_stop_status_unavailable");
 return paymentStopStatusSchema.parse(data);
}

/** Telemetry failure must not prevent expiry processing or masquerade as a healthy run. */
export async function runScheduledPaymentStops(){
 const owner=resolveTrustedNatoriOwnerId();
 if(owner.kind!=="ok")return {kind:"not-configured" as const};
 const runId=randomUUID();let recorded=false;
 try{const r=await supabaseAdmin().rpc("natori_payment_stop_run_v1",{p_owner_id:owner.ownerId,p_run_id:runId});recorded=!r.error&&r.data===true;}catch{/* Keep stopping due links. */}
 let result:Awaited<ReturnType<typeof stopDuePaymentLinks>>;
 try{result=await stopDuePaymentLinks();}catch{result={kind:"db-error"};}
 try{
  const r=await supabaseAdmin().rpc("natori_payment_stop_run_v1",{p_owner_id:owner.ownerId,p_run_id:runId,p_result:result});
  recorded=recorded&&!r.error&&r.data===true;
 }catch{recorded=false;}
 const summary={source:"scheduled",kind:result.kind,recorded,...(result.kind==="ok"?{scanned:result.scanned,expired:result.expired,skipped:result.skipped,failed:result.failed}:{})};
 if(!recorded||result.kind!=="ok"||result.failed>0)console.warn("[natori-payment-stop]",summary);
 else console.info("[natori-payment-stop]",summary);
 return recorded?result:{kind:"db-error" as const};
}
