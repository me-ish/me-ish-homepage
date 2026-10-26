import "server-only";
import {setImmediate as yieldToIO} from "node:timers/promises";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveNatoriManagementContext } from "./natoriOwner";
import { readCaseManagement } from "./caseManagementReader";
import { CASE_MANAGEMENT_SQL } from "./caseManagementQuery";
import type { CaseWorkspaceRecord } from "../types/caseWorkspace";
import { assertServerAcceptanceTarget } from "@/lib/caseAcceptanceEnvironment";
import { acceptanceProjectAllowed } from "./caseAcceptance";
import { isLoopbackUrl } from "../lib/caseAcceptanceTarget";
import {collectCaseEntryPages} from "./caseEntryPages";
import {readCaseSystemHold} from "./caseSystemHold";
import {assertCaseReleaseTarget} from "./caseRelease";

export const CASE_WORKSPACE_LIMIT = 50;
const collection = z.object({ complete: z.boolean(), rows: z.array(z.unknown()) });
const identity = z.object({ project: z.object({ id: z.uuid(), user_id: z.uuid() }) });
type Rpc = (name: "natori_case_workspace_v1", args: { p_owner_id: string }, options: { get: true }) => PromiseLike<{ data: unknown; error: unknown }>;

export function caseWorkspaceReadAvailable(): boolean {
  try {
    if (assertCaseReleaseTarget()) return true;
    if (assertServerAcceptanceTarget(true)) return true;
    return (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")
      && !process.env.VERCEL_ENV && isLoopbackUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  } catch { return false; }
}

/** Existing server credential; one fixed read-only RPC, never a raw SQL API. */
export async function fetchCaseWorkspaceEnvelopes(ownerId: string): Promise<unknown> {
  const flag=process.env.NATORI_CASE_DASHBOARD_PREVIEW_ENABLED;
  // An armed read-only rollback must retain full collection completeness even
  // after the entry flag is removed. A failed status read is not legacy consent.
  const persisted=flag!=="1"&&flag!=="read-only"?await readCaseSystemHold(ownerId):null;
  if(flag==="1"||flag==="read-only"||persisted?.armed){
    const value=await collectCaseEntryPages(ownerId,"cases"),rows=[];
    for(const row of value.rows){const target=identity.parse(row);if(!assertServerAcceptanceTarget(true)||await acceptanceProjectAllowed(target.project.id))rows.push(row);}
    return {complete:true,rows};
  }
  const admin = supabaseAdmin();
  const rpc = admin.rpc.bind(admin) as unknown as Rpc;
  const { data, error } = await rpc("natori_case_workspace_v1", { p_owner_id: ownerId }, { get: true });
  if (error) throw new Error("case_read_unavailable");
  if(assertServerAcceptanceTarget(true)){
    const parsed=collection.parse(data),rows=[];
    for(const row of parsed.rows){const value=identity.parse(row);if(await acceptanceProjectAllowed(value.project.id))rows.push(row);}
    return {...parsed,rows};
  }
  return data;
}

export type CaseWorkspaceReadResult =
  | { state: "ready"; records: readonly CaseWorkspaceRecord[] }
  | { state: "unavailable"; reason: "read_failed" | "incomplete" | "collection_limit" };

/** All identities are checked before adapting or returning any row. No partial owner leakage. */
export async function readCaseWorkspace(
  read: (ownerId: string) => Promise<unknown> = fetchCaseWorkspaceEnvelopes,
): Promise<CaseWorkspaceReadResult> {
  const context = await resolveNatoriManagementContext();
  let value: unknown;
  try { value = await read(context.ownerId); } catch { return { state: "unavailable", reason: "read_failed" }; }
  const parsed = collection.safeParse(value);
  if (!parsed.success) return { state: "unavailable", reason: "incomplete" };
  if (!parsed.data.complete) return { state: "unavailable", reason: "collection_limit" };
  const rows = new Map<string, unknown>();
  for (const row of parsed.data.rows) {
    const target = identity.safeParse(row);
    if (!target.success || target.data.project.user_id !== context.ownerId || rows.has(target.data.project.id)) {
      return { state: "unavailable", reason: "incomplete" };
    }
    rows.set(target.data.project.id, row);
  }
  const records: CaseWorkspaceRecord[] = [];
  for (const [projectId, row] of rows) {
    // A long sequence of already-resolved reads otherwise monopolizes one
    // microtask turn and delays unrelated Auth/index responses at larger scales.
    if(records.length>0&&records.length%25===0)await yieldToIO();
    const result = await readCaseManagement(projectId, async statement => {
      if (statement.text !== CASE_MANAGEMENT_SQL || statement.values[0] !== projectId || statement.values[1] !== context.ownerId) {
        throw new Error("case_scope_mismatch");
      }
      return { rows: [row] };
    });
    if (result.state !== "ready") return { state: "unavailable", reason: "incomplete" };
    records.push({ id: projectId, title: result.metadata.title?.trim() || "案件名未確認",
      clientLabel: result.metadata.clientLabel?.trim() || "依頼者名未確認",
      registeredDueDate: result.metadata.registeredDueDate, model: result.model, display: result.display });
  }
  return { state: "ready", records };
}
