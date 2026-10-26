import "server-only";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { caseWorkspaceReadAvailable } from "./caseWorkspaceRead";
import { resolveTrustedNatoriOwnerId } from "./trustedNatoriOwner";

/** Authorized Cron only, same non-production runtime boundary, independent of send/command flags. */
export async function retireCasePaymentReceipts(){
 if(!caseWorkspaceReadAvailable())return {enabled:false as const};
 const owner=resolveTrustedNatoriOwnerId();
 if(owner.kind!=="ok")throw Error("receipt_retirement_owner_unavailable");
 const {data,error}=await supabaseAdmin().rpc("natori_case_payment_receipts_retire_v1",{p_owner_id:owner.ownerId,p_limit:100});
 if(error)throw Error("receipt_retirement_unavailable");
 const result=z.object({retired:z.number().int().nonnegative(),deferred:z.number().int().nonnegative(),remaining:z.number().int().nonnegative(),oldestEligibleAt:z.string().refine(v=>Number.isFinite(Date.parse(v))).nullable()}).parse(data);
 if(result.remaining>0)console.warn("[natori-receipt-retention]",{remaining:result.remaining,oldestEligibleAt:result.oldestEligibleAt});
 return {enabled:true as const,...result};
}
