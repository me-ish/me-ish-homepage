import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertServerAcceptanceTarget } from "@/lib/caseAcceptanceEnvironment";
import { acceptanceProjectAllowed } from "./caseAcceptance";
import { readCaseManagement, type CaseReadExecutor } from "./caseManagementReader";
import type { CaseWorkspaceRecord } from "../types/caseWorkspace";

export async function readCaseDetail(projectId: string, execute?: CaseReadExecutor) {
  if (assertServerAcceptanceTarget(true) && !await acceptanceProjectAllowed(projectId))
    return { state: "not_found" as const };
  const result = await readCaseManagement(projectId, execute ?? (async statement => {
    const { data, error } = await supabaseAdmin().rpc("natori_case_snapshot_v1", {
      p_project_id: statement.values[0], p_owner_id: statement.values[1],
    }, { get: true });
    if (error) throw Error("case_detail_unavailable");
    if (!Array.isArray(data)) throw Error("case_detail_incomplete");
    return { rows: data };
  }));
  if (result.state !== "ready") return result;
  const record: CaseWorkspaceRecord = {
    id: projectId, title: result.metadata.title?.trim() || "案件名未確認",
    clientLabel: result.metadata.clientLabel?.trim() || "依頼者名未確認",
    registeredDueDate: result.metadata.registeredDueDate,
    model: result.model, display: result.display,
  };
  return { state: "ready" as const, record };
}
