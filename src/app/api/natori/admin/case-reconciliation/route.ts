import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCsrf } from "@/lib/auth/csrf";
import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
import { reconciliationEnabled, readCaseReconciliation, commandCaseReconciliation } from "@/features/natori/server/caseReconciliation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", Vary: "Cookie" };
export const GET = withNatoriManagement("case-reconciliation.GET", false, async (request: Request) => {
  if (!reconciliationEnabled()) return NextResponse.json({ enabled: false }, { headers });
  const params=new URL(request.url).searchParams,notice=params.get("notificationId");
  const id = z.uuid().safeParse(params.get("projectId"));
  if (!id.success||(notice!==null&&!z.uuid().safeParse(notice).success)) return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  try { const view = await readCaseReconciliation(id.data,undefined,notice??undefined); return NextResponse.json({ view }, { status: view ? 200 : 404, headers }); }
  catch { return NextResponse.json({ error: "read_unavailable" }, { status: 503, headers }); }
});
export const POST = withNatoriManagement("case-reconciliation.POST", true, async (request: Request) => {
  const denied = checkCsrf(request); if (denied) return denied;
  if (!reconciliationEnabled()) return NextResponse.json({ error: "not_configured" }, { status: 503, headers });
  try {
    const result = await commandCaseReconciliation(await request.json());
    return NextResponse.json(result, { status: ["stale", "busy", "conflict", "needs_review"].includes(result.result) ? 409 : result.result === "not_found" ? 404 : 200, headers });
  } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? "invalid_request" : "result_unconfirmed" }, { status: error instanceof z.ZodError ? 400 : 503, headers }); }
});
