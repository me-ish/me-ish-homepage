import { NextResponse } from "next/server";
import { z } from "zod";
import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
import { caseDashboardSystemMode } from "@/features/natori/server/caseDashboardPreview";
import { readCaseDetail } from "@/features/natori/server/caseDetailRead";
export const runtime = "nodejs", dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export const GET = withNatoriManagement("case-detail.GET", false, async (request: Request) => {
  if ((await caseDashboardSystemMode()) === "off") return NextResponse.json({ error: "unavailable" }, { status: 404, headers });
  const id = new URL(request.url).searchParams.get("projectId");
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "invalid" }, { status: 400, headers });
  const result = await readCaseDetail(id!);
  if (result.state !== "ready") return NextResponse.json({ error: "unavailable" }, { status: result.state === "not_found" ? 404 : 503, headers });
  return NextResponse.json({ contract: "natori-case-detail-v1", record: result.record }, { headers });
});
