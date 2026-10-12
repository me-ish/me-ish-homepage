import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import { acknowledgeStaffRoughOk, retryStaffRoughOkNotification } from "@/features/natori/server/roughFollowupService";

export const runtime = "nodejs", dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export const POST = withNatoriManagement("consultation.rough-ok.POST", true, async (request: Request) => {
  if (!await canUseNatoriManagement()) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const csrf = checkCsrf(request);
  if (csrf) return csrf;
  const raw: unknown = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400, headers });
  const { projectId, roughId, action } = raw as Record<string, unknown>;
  if (typeof projectId !== "string" || typeof roughId !== "string" || (action !== "acknowledge" && action !== "retry-notification")) return NextResponse.json({ error: "Invalid request" }, { status: 400, headers });
  if (action === "retry-notification") {
    try {
      return await retryStaffRoughOkNotification(projectId, roughId)
        ? NextResponse.json({ ok: true, roughId }, { headers })
        : NextResponse.json({ error: "メールの再試行を開始できません。通知の状態を更新して確認してください" }, { status: 409, headers });
    } catch {
      return NextResponse.json({ error: "通知の状態を確認できません" }, { status: 503, headers });
    }
  }
  switch (await acknowledgeStaffRoughOk(projectId, roughId)) {
    case "ok": return NextResponse.json({ ok: true, roughId }, { headers });
    case "already": return NextResponse.json({ ok: true, roughId, already: true }, { headers });
    case "not-found": return NextResponse.json({ error: "Not found" }, { status: 404, headers });
    case "not-ok": return NextResponse.json({ error: "依頼者のOKをまだ確認できません" }, { status: 409, headers });
    case "closed": return NextResponse.json({ error: "終了した相談のため変更できません" }, { status: 409, headers });
    default: return NextResponse.json({ error: "ラフOKの確認を保存できません。履歴を更新して再確認してください" }, { status: 503, headers });
  }
});
