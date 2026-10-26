import "server-only";
import type { ReconciliationFacts, ReconciliationIdentity } from "../lib/caseReconciliation";

import { assertServerAcceptanceTarget } from "@/lib/caseAcceptanceEnvironment";
import { acceptanceContext, acceptanceRpc, acceptanceStripeKey } from "./caseAcceptance";
import { createAcceptanceReconciliationProvider, type ReconciliationProvider } from "./caseReconciliationAdapter";
import { productionReconciliationProvider } from "./caseProductionReconciliation";
export type { ReconciliationProvider } from "./caseReconciliationAdapter";

/** Separate explicit release and acceptance profiles; ordinary/default remains closed. */
export function reconciliationProvider(beforeMutation?:()=>Promise<void>): ReconciliationProvider {
  const production = productionReconciliationProvider(beforeMutation);
  if (production) return production;
  if (assertServerAcceptanceTarget(true)) return createAcceptanceReconciliationProvider({fetch:globalThis.fetch,key:()=>acceptanceStripeKey(true),context:acceptanceContext,beforeMutation,
    mail:i=>acceptanceRpc("natori_case_mail_evidence_v1",{p_owner:i.owner,p_project:i.project,p_job:i.target})});

  const unavailable = async (identity: ReconciliationIdentity): Promise<ReconciliationFacts> => ({
    state: "unavailable", source: "provider_retrieval", identity, checkedAt: new Date().toISOString(),
    complete: false, limits: ["provider_unavailable"],
  });
  return { inspect: (_kind, identity) => unavailable(identity), stopOldLink: unavailable };
}
