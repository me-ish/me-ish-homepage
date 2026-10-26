import { caseContext, casePlanning } from "../lib/caseScreenContext";
import { CaseWorkspaceLoadError } from "../types/caseWorkspaceLoad";
async function get(path: string, signal?: AbortSignal) {
  const r = await fetch(path, {
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });
  if (r.status === 401) throw new CaseWorkspaceLoadError("unauthorized");
  if (!r.ok) throw new CaseWorkspaceLoadError("unavailable");
  return r.json();
}
export async function loadCaseContext(id: string) {
  return caseContext.parse(
    await get(
      "/api/natori/admin/case-context?projectId=" + encodeURIComponent(id),
    ),
  );
}
export async function loadCasePlanning(signal?: AbortSignal) {
  return casePlanning.parse(
    await get("/api/natori/admin/case-planning", signal),
  );
}
