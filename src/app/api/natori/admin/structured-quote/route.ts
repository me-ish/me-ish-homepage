import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import { validateNatoriQuoteIssuePayloadV1 } from "@/features/natori/lib/quoteSnapshot";
import { issueStructuredQuoteAndSend } from "@/features/natori/server/structuredQuoteService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const raw = await request.json().catch(() => null);
  const parsed = validateNatoriQuoteIssuePayloadV1(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "正式見積の内容が不正です", issues: parsed.issues },
      { status: 400 },
    );
  }

  const result = await issueStructuredQuoteAndSend(parsed.data);
  switch (result.kind) {
    case "not-found":
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    case "not-configured":
      return NextResponse.json({ error: "Mail is not configured" }, { status: 500 });
    case "invalid-state":
      return NextResponse.json(
        { error: "現在の案件状態では正式見積を発行できません" },
        { status: 409 },
      );
    case "rejected":
      return NextResponse.json(
        { error: "正式見積の発行条件を満たしていません", reason: result.reason },
        { status: 409 },
      );
    case "db-error":
      return NextResponse.json({ error: "正式見積の保存に失敗しました" }, { status: 500 });
    case "mail-error":
      return NextResponse.json(
        { error: "正式見積は保存されましたが、メール送信に失敗しました。再発行しないでください。" },
        { status: 502 },
      );
    case "ok":
      return NextResponse.json({
        ok: true,
        quoteId: result.quoteId,
        version: result.version,
        reused: result.reused,
      });
  }
}
