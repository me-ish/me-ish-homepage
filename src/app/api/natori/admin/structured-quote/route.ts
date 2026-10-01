import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import { validateNatoriQuoteIssuePayloadV1 } from "@/features/natori/lib/quoteSnapshot";
import { validateStructuredQuoteDeliveryAttempt } from "@/features/natori/lib/structuredQuoteAttempt";
import { getStructuredQuoteRecovery, issueStructuredQuoteAndSend } from "@/features/natori/server/structuredQuoteService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withNatoriManagement("structured-quote.POST", true, async function POST(request: Request) {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const raw = await request.json().catch(() => null);
  const parsed = validateNatoriQuoteIssuePayloadV1(raw);
  const attempt = validateStructuredQuoteDeliveryAttempt(raw);
  const draftRevision = raw && typeof raw === "object" && "draftRevision" in raw
    ? (raw as { draftRevision: unknown }).draftRevision : null;
  if (!parsed.success || !attempt.success || !Number.isSafeInteger(draftRevision) || Number(draftRevision) < 1) {
    return NextResponse.json(
      {
        error: "正式見積の内容が不正です",
        issues: parsed.success ? [{ code: "delivery_attempt_invalid" }] : parsed.issues,
      },
      { status: 400 },
    );
  }

  const result = await issueStructuredQuoteAndSend({
    ...parsed.data,
    ...attempt.data,
    draftRevision: Number(draftRevision),
  });
  switch (result.kind) {
    case "not-found":
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    case "not-configured":
      return NextResponse.json({ error: "Mail is not configured" }, { status: 500 });
    case "invalid-attempt":
      return NextResponse.json(
        { error: "見積発行操作の再試行情報が不正です" },
        { status: 400 },
      );
    case "invalid-state":
      return NextResponse.json(
        { error: "現在の案件状態では正式見積を発行できません" },
        { status: 409 },
      );
    case "rejected": {
      const message = result.reason === "estimate_draft_changed" ? "下書きが更新されました。再読み込みして確認してください。"
        : result.reason === "estimate_terms_incomplete" || result.reason === "estimate_due_date_past"
          ? "制作条件と納品日を確認してください。" : "正式見積りの内容を確認してください。";
      return NextResponse.json(
        { error: message, reason: result.reason },
        { status: 409 },
      );
    }
    case "db-error":
      return NextResponse.json(
        {
          error: "正式見積の保存結果を確認できませんでした。同じ内容で再試行してください。",
          retryable: true,
        },
        { status: 500 },
      );
    case "mail-error":
      return NextResponse.json(
        {
          error: "正式見積は保存されましたが、メール送信に失敗しました。同じ内容で再試行してください。",
          retryable: true,
        },
        { status: 502 },
      );
    case "ok":
      return NextResponse.json({
        ok: true,
        quoteId: result.quoteId,
        version: result.version,
        reused: result.reused,
        notificationId: result.notificationId,
        notificationStatus: result.notificationStatus,
      });
  }
});

export const GET = withNatoriManagement("structured-quote.GET", false, async function GET(request: Request) {
  if (!(await canUseNatoriManagement())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const projectId = new URL(request.url).searchParams.get("projectId") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
    return NextResponse.json({ error: "Invalid project" }, { status: 400 });
  }
  try { return NextResponse.json(await getStructuredQuoteRecovery(projectId)); }
  catch { return NextResponse.json({ error: "Quote recovery unavailable" }, { status: 503 }); }
});
