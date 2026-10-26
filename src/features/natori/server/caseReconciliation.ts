import "server-only";
import {assertCaseSystemAdmission} from "./caseSystemHold";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Json } from "@/types/supabase";
import { resolveNatoriManagementContext } from "./natoriOwner";
import { caseWorkspaceReadAvailable } from "./caseWorkspaceRead";
import { reconciliationCommand, reconciliationFacts, reconciliationIdentity, reconciliationView, evidenceCanApply } from "../lib/caseReconciliation";
import { reconciliationProvider, type ReconciliationProvider } from "./caseReconciliationProvider";

export const reconciliationEnabled = () => caseWorkspaceReadAvailable();
export type ReconciliationRpc = (owner: string, project: string, command: string, input: Json) => Promise<unknown>;
const rpc: ReconciliationRpc = async (owner, project, command, input) => {
  if(command==="read-notice"){
    const target=z.object({notificationId:z.uuid()}).parse(input);
    const result=await supabaseAdmin().rpc("natori_case_reconciliation_notice_read_v1",{p_owner:owner,p_project:project,p_notice:target.notificationId},{get:true});
    if(result.error)throw Error("reconciliation_unavailable");return result.data;
  }
  const { data, error } = await supabaseAdmin().rpc("natori_case_reconciliation_v1", { p_owner_id: owner, p_project_id: project, p_command: command, p_input: input });
  if (error) throw Error("reconciliation_unavailable");
  return data;
};
const resultSchema = z.object({ result: z.string() }).passthrough();
export async function readCaseReconciliation(project: string, call: ReconciliationRpc = rpc, notificationId?:string) {
  const context = await resolveNatoriManagementContext();
  const value = await call(context.ownerId, project, notificationId?"read-notice":"read", notificationId?{notificationId}:{});
  if (resultSchema.parse(value).result === "not_found") return null;
  const view=reconciliationView.parse(value);
  if(notificationId&&(view.selectedNotice!==notificationId||view.notifications.length!==1||view.notifications[0].id!==notificationId))throw Error("reconciliation_scope_mismatch");
  return view;
}

export async function commandCaseReconciliation(value: unknown, dependencies: { call?: ReconciliationRpc; provider?: ReconciliationProvider } = {}) {
  const c = reconciliationCommand.parse(value), context = await resolveNatoriManagementContext(), call = dependencies.call ?? rpc;
  if (c.action === "apply-evidence") return resultSchema.parse(await call(context.ownerId, c.projectId, "apply", {
    id: c.id, evidenceId: c.evidenceId, resolutionId: c.resolutionId, operator: context.operator,
  }));
  const token = randomUUID();
  const claimed = z.object({ result: z.string(), generation: z.number().optional(), identity: reconciliationIdentity.optional() }).parse(await call(context.ownerId, c.projectId, "claim", {
    id: c.id, kind: c.kind, mode: c.action === "stop-old-link" ? "stop" : "read", target: c.target, revision: c.revision, token, operator: context.operator,
  }));
  if (claimed.result !== "claimed" || !claimed.identity || !claimed.generation) return { result: claimed.result };
  const identity = claimed.identity, provider = dependencies.provider ?? reconciliationProvider(async()=>{
    await assertCaseSystemAdmission("sender",context.ownerId);
    const checked=resultSchema.parse(await call(context.ownerId,c.projectId,"fence",{id:c.id,token,generation:claimed.generation}));
    if(checked.result!=="current")throw Error("inspection_stale");
  });
  let facts;
  try {
    // Missing historical scope cannot be filled from today's credential or display name.
    if (!identity.account || (identity.livemode === null && !(c.kind === "mail" && identity.mailEnvironment))) facts = reconciliationFacts.parse({ state: "unavailable", source: "provider_retrieval", identity, checkedAt: new Date().toISOString(), complete: false, limits: ["scope_missing"] });
    else {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const controller = new AbortController();
      try {
        if(c.action==="stop-old-link")await assertCaseSystemAdmission("sender",context.ownerId);
        facts = reconciliationFacts.parse(await Promise.race([
          c.action === "stop-old-link" ? provider.stopOldLink(identity,controller.signal) : provider.inspect(c.kind, identity,controller.signal),
          new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(Error("inspection_timeout")), 15000); }),
        ]));
      } finally { controller.abort(); clearTimeout(timer); }
      if (!isDeepStrictEqual(facts.identity, identity)) facts = { state: "mismatch" as const, source: "provider_retrieval" as const, identity, checkedAt: new Date().toISOString(), complete: false, limits: ["identity_mismatch" as const] };
      if (facts.state === "confirmed" && !evidenceCanApply(c.kind, facts)) facts = { ...facts, state: "unknown" as const };
    }
  } catch {
    facts = reconciliationFacts.parse({ state: "unavailable", source: "provider_retrieval", identity, checkedAt: new Date().toISOString(), complete: false, limits: ["provider_unavailable"] });
  }
  // Only server-obtained bounded facts enter this RPC. Browser JSON is never proof.
  return resultSchema.parse(await call(context.ownerId, c.projectId, "save", { id: c.id, token, generation: claimed.generation, evidenceId: randomUUID(), facts: facts as Json }));
}
