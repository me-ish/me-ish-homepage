import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import { markStaffRough, unmarkStaffRough } from "@/features/natori/server/talkRoughService";

export const runtime = "nodejs", dynamic = "force-dynamic";

/** Staff marks (or un-marks) one of their attachment messages as a rough. */
export const POST = withNatoriManagement("consultation.rough.POST", true, async (request: Request) => {
  if (!(await canUseNatoriManagement())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const csrf = checkCsrf(request);
  if (csrf) return csrf;
  const raw: unknown = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { projectId, messageId, action } = raw as Record<string, unknown>;
  if (typeof projectId !== "string" || typeof messageId !== "string" || (action !== "mark" && action !== "unmark")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const result = action === "mark" ? await markStaffRough(projectId, messageId) : await unmarkStaffRough(projectId, messageId);
  const headers = { "Cache-Control": "no-store" };
  switch (result) {
    case "ok": return NextResponse.json({ ok: true }, { headers });
    case "already": return NextResponse.json({ ok: true, already: true }, { headers });
    case "invalid": return NextResponse.json({ error: "添付のあるメッセージだけをラフにできます" }, { status: 400, headers });
    case "not-found": return NextResponse.json({ error: "Not found" }, { status: 404, headers });
    case "closed": return NextResponse.json({ error: "終了した相談のため変更できません" }, { status: 409, headers });
    default: return NextResponse.json({ error: "ラフの機能を利用できません。少し待ってからもう一度お試しください" }, { status: 503, headers });
  }
});
