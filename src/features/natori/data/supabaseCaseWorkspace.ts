"use client";
import type { CaseWorkspaceRecord } from "../types/caseWorkspace";
import { CaseWorkspaceLoadError } from "../types/caseWorkspaceLoad";

export async function loadCaseSystemPaused(signal:AbortSignal):Promise<boolean>{
 const response=await fetch("/api/natori/admin/case-system",{method:"GET",credentials:"same-origin",cache:"no-store",signal});
 if(response.status===401)throw new CaseWorkspaceLoadError("unauthorized");
 const value:unknown=await response.json().catch(()=>null);
 if(!response.ok||!value||typeof value!=="object"||!("paused" in value)||typeof value.paused!=="boolean")throw new CaseWorkspaceLoadError("unavailable");
 return value.paused;
}

/** GET-only; no auth headers, owner parameter, mutation endpoint, or local persistence. */
export async function loadCaseWorkspace(_mode: string, signal: AbortSignal): Promise<readonly CaseWorkspaceRecord[]> {
  const response = await fetch("/api/natori/admin/case-workspace", { method: "GET", credentials: "same-origin", cache: "no-store", signal });
  const data: unknown = await response.json().catch(() => null);
  const object = data !== null && typeof data === "object" ? data as Record<string,unknown> : null;
  if (response.status === 401) throw new CaseWorkspaceLoadError("unauthorized");
  if (object?.code === "natori_owner_unavailable") throw new CaseWorkspaceLoadError("scope_unavailable");
  if (!response.ok || object?.contract!=="natori-case-workspace-v1" || !Array.isArray(object.records)) throw new CaseWorkspaceLoadError("unavailable");
  return object.records as CaseWorkspaceRecord[];
}

export async function loadCaseWorkspaceDetail(projectId: string, signal: AbortSignal): Promise<CaseWorkspaceRecord> {
  const response = await fetch(`/api/natori/admin/case-detail?projectId=${encodeURIComponent(projectId)}`, { method: "GET", credentials: "same-origin", cache: "no-store", signal });
  const value = await response.json().catch(() => null);
  if (response.status === 401) throw new CaseWorkspaceLoadError("unauthorized");
  if (value?.code === "natori_owner_unavailable") throw new CaseWorkspaceLoadError("scope_unavailable");
  if (response.status === 404) throw new CaseWorkspaceLoadError("not_found");
  if (!response.ok || value?.contract !== "natori-case-detail-v1" || value.record?.id !== projectId) throw new CaseWorkspaceLoadError("unavailable");
  return value.record;
}
