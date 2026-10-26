import "server-only";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertServerAcceptanceTarget } from "@/lib/caseAcceptanceEnvironment";
import { acceptanceProjectAllowed } from "./caseAcceptance";
import { resolveNatoriManagementContext } from "./natoriOwner";
import { readCaseManagement } from "./caseManagementReader";
import { caseHistoryPage, assertHistoryPage, type CaseFinancialDisplay, type CaseHistoryView } from "../lib/caseHistory";
const summary=z.object({available:z.literal(true),originalMapped:z.boolean(),confirmedAmount:z.number().int().nonnegative().safe().nullable(),pendingCount:z.number().int().nonnegative().safe(),reviewCount:z.number().int().nonnegative().safe()});
export type CaseHistoryRead=(args:{p_owner:string;p_project:string;p_offset:number;p_revision?:string})=>PromiseLike<{data:unknown;error:unknown}>;
export async function readCaseHistory(projectId:string,offset:number,revision:string|null,read?:CaseHistoryRead):Promise<{state:"ready";view:CaseHistoryView}|{state:"not_found"|"changed"}>{
 const {ownerId}=await resolveNatoriManagementContext();
 if(assertServerAcceptanceTarget(true)&&!await acceptanceProjectAllowed(projectId))return {state:"not_found"};
 const result=await (read??(args=>supabaseAdmin().rpc("natori_case_history_page_v1",args,{get:true})))({p_owner:ownerId,p_project:projectId,p_offset:offset,...(revision===null?{}:{p_revision:revision})});
 if(result.error)throw Error("history_unavailable");if(result.data===null)return {state:"not_found"};
 const raw=caseHistoryPage.extend({ownerId:z.uuid(),snapshot:z.unknown(),refundSummary:z.unknown(),legacyEntries:z.array(z.object({dateISO:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),label:z.enum(["見積もりメール送信","支払い依頼メール送信","ラフ提出メール送信","納品メール送信","Stripe入金","旧メモの記録"])}))}).parse(result.data);
 if(raw.ownerId!==ownerId||raw.projectId!==projectId)throw Error("history_scope_mismatch");
 if(raw.changed)return {state:"changed"};
 assertHistoryPage(raw,projectId,offset,revision);
 let financial:CaseFinancialDisplay|null=null;
 if(offset===0){
  const fact=await readCaseManagement(projectId,async()=>({rows:[raw.snapshot]}));
  if(fact.state!=="ready")throw Error("history_snapshot_unavailable");
  const payment=fact.model.facts.payment,refund=summary.safeParse(raw.refundSummary);
  const gross=payment.state==="ready"&&payment.value.method!=="unclassified"?payment.value.money?.amount??null:null;
  const valid=refund.success&&refund.data.originalMapped&&fact.model.facts.financialReview.state==="ready"&&fact.model.facts.financialReview.value.length===0&&refund.data.pendingCount===0&&refund.data.reviewCount===0&&gross!==null&&refund.data.confirmedAmount!==null&&refund.data.confirmedAmount<=gross;
  const refunded=valid&&refund.success?refund.data.confirmedAmount:null;
  financial={gross,legacyRecordedAmount:payment.state==="ready"&&payment.value.method==="unclassified"?payment.value.money?.amount??null:null,method:payment.state==="ready"?payment.value.method:null,confirmedAt:payment.state==="ready"?payment.value.confirmedAt:null,
   refunded,net:gross===null||refunded===null?null:gross-refunded,pendingCount:refund.success?refund.data.pendingCount:null,reviewCount:refund.success?refund.data.reviewCount:null,state:valid?"verified":"unverified"};
 }
 const {ownerId:_owner,snapshot:_snapshot,refundSummary:_refund,legacyEntries,...page}=raw;
 return {state:"ready",view:{...page,financial,legacyLogs:offset===0?legacyEntries:[]}};
}
