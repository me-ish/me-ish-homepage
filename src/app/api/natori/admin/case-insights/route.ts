import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
// api/natori/admin/case-insights/route.ts
// 案件ごとの「振り返り用の記録」（依頼の経路・見送りの理由・リピーターかどうか）の読み書き。
// 業務ロジックは caseInsightsService に集約し、ここは HTTP の出入りだけ。
import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCsrf } from "@/lib/auth/csrf";
import { checkSameOrigin } from "@/lib/auth/origin";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import { getNatoriCaseInsights, updateNatoriCaseInsights, type CaseInsightsResult } from "@/features/natori/server/caseInsightsService";
import { caseInsightsUpdate } from "@/features/natori/lib/caseInsights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

function respond(result: CaseInsightsResult) {
  switch (result.kind) {
    case "ok":
      return NextResponse.json({ ok: true, insights: result.insights }, { headers: noStore });
    case "not-found":
      return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });
    case "db-error":
      return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503, headers: noStore });
  }
}

export const GET = withNatoriManagement("case-insights.GET", false, async function GET(request: Request) {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }
  const projectId = z.uuid().safeParse(new URL(request.url).searchParams.get("projectId"));
  if (!projectId.success) return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: noStore });
  return respond(await getNatoriCaseInsights(projectId.data));
});

export const PATCH = withNatoriManagement("case-insights.PATCH", true, async function PATCH(request: Request) {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }
  const originError = checkSameOrigin(request);
  if (originError) return originError;
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;
  const parsed = caseInsightsUpdate.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: noStore });
  return respond(await updateNatoriCaseInsights(parsed.data.projectId, parsed.data.patch));
});
