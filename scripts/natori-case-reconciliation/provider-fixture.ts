// Copied ONLY over the provider factory in the disposable full-app test copy.
import "server-only";
import { appendFileSync } from "node:fs";
import type { ReconciliationFacts, ReconciliationIdentity, ReconciliationKind } from "../../src/features/natori/lib/caseReconciliation";
export function reconciliationProvider() {
 const inspect = async (kind: ReconciliationKind, identity: ReconciliationIdentity): Promise<ReconciliationFacts> => {
  appendFileSync(process.env.CASE_PAYMENT_EVIDENCE!,JSON.stringify({boundary:"reconciliation",kind,target:identity.target})+"\n");
  const suffix=identity.attempt?.replaceAll('-','')??'fixture';
  return {state:"confirmed",source:"provider_retrieval",identity,checkedAt:new Date().toISOString(),complete:true,limits:[],
   reference:kind==='price'?'price_'+suffix:kind==='mail'?'mail_'+suffix:kind==='payment'?'cs_'+suffix:identity.link??'plink_'+suffix,
   outcome:kind==='price'?'created':kind==='mail'?'accepted':kind==='payment'?'paid':kind==='stop'?'stopped':'active',
   ...(kind==='mail'?{occurredAt:new Date().toISOString()}:{price:identity.price??'price_'+suffix,url:'https://buy.stripe.com/'+suffix}),
   ...(kind==='stop'?{sessionsSafe:true}:{}),...(kind==='payment'?{link:identity.link!,paymentIntent:'pi_'+suffix}:{})};
 };
 return {inspect,stopOldLink:(identity:ReconciliationIdentity)=>inspect('stop',identity)};
}
