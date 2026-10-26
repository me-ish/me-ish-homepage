import { NextResponse } from "next/server";
import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
import { caseWorkspaceReadAvailable, readCaseWorkspace } from "@/features/natori/server/caseWorkspaceRead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

export const GET = withNatoriManagement("case-workspace.GET", false, async () => {
  if (!caseWorkspaceReadAvailable()) return NextResponse.json({ error: "not_available" }, { status: 404, headers });
  const result = await readCaseWorkspace();
  if (result.state !== "ready") return NextResponse.json({ error: "case_read_unavailable", code: result.reason }, { status: 503, headers });
  return NextResponse.json({ contract: "natori-case-workspace-v1", records: result.records }, { headers });
});
