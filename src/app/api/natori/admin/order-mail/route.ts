import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
// api/natori/admin/order-mail/route.ts
// ダッシュボードから依頼者へ見積もりメール / 支払い依頼メールを送る。
// 業務ロジックは orderMailService に集約（route は薄く）。
import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import { sendNatoriOrderMail } from "@/features/natori/server/orderMailService";
import { isValidQuoteDate } from "@/features/natori/lib/quoteTerms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = withNatoriManagement("order-mail.POST", true, async function POST(request: Request) {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const payload = (await request.json().catch(() => null)) as {
    kind?: unknown;
    projectId?: unknown;
    to?: unknown;
    subject?: unknown;
    body?: unknown;
    amount?: unknown;
    quoteTitle?: unknown;
    deliverables?: unknown;
    dueDate?: unknown;
    operationId?: unknown;
    fileIds?: unknown;
  } | null;
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const kind = payload.kind;
  if (kind !== "estimate" && kind !== "payment" && kind !== "rough" && kind !== "delivery") {
    return NextResponse.json(
      { error: "kind must be estimate / payment / rough / delivery" },
      { status: 400 }
    );
  }

  const projectId = typeof payload.projectId === "string" ? payload.projectId.trim() : "";
  const to = typeof payload.to === "string" ? payload.to.trim() : "";
  const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const amountRaw = Number(payload.amount);
  const amount = Number.isFinite(amountRaw) ? Math.round(amountRaw) : NaN;

  if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  if (!EMAIL_RE.test(to) || to.length > 254) {
    return NextResponse.json({ error: "valid to address is required" }, { status: 400 });
  }
  if (!subject || subject.length > 200) {
    return NextResponse.json({ error: "subject is required (max 200)" }, { status: 400 });
  }
  if (!body || body.length > 8000) {
    return NextResponse.json({ error: "body is required (max 8000)" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "amount must be a non-negative integer" }, { status: 400 });
  }
  // Stripe の JPY 最小決済額（50円相当）を下回るリンクは作れない
  if (kind === "payment" && amount < 50) {
    return NextResponse.json({ error: "payment amount must be at least 50 yen" }, { status: 400 });
  }

  const quoteTitle = typeof payload.quoteTitle === "string" ? payload.quoteTitle.trim() : "";
  const deliverables = typeof payload.deliverables === "string" ? payload.deliverables.trim() : "";
  const dueDate = typeof payload.dueDate === "string" ? payload.dueDate : "";
  if (kind === "estimate" && (
    !quoteTitle || quoteTitle.length > 200 ||
    !deliverables || deliverables.length > 1000 ||
    !isValidQuoteDate(dueDate)
  )) {
    return NextResponse.json({ error: "ご依頼内容・制作するもの・納品日を確認してください。" }, { status: 400 });
  }

  const result = await sendNatoriOrderMail({
    kind, projectId, to, subject, body, amount,
    ...(kind === "estimate" ? { quoteTitle, deliverables, dueDate } : {}),
    ...(kind === "delivery" ? {
      operationId: typeof payload.operationId === "string" ? payload.operationId : undefined,
      fileIds: Array.isArray(payload.fileIds) && payload.fileIds.every((id): id is string => typeof id === "string") ? payload.fileIds : undefined,
    } : {}),
  });
  switch (result.kind) {
    case "delivery-conflict":
      return NextResponse.json({ error: "前回と送信内容が異なります。前回の結果を確認してから、新しい案内として送信してください。", code: "delivery_conflict" }, { status: 409 });
    case "delivery-expired":
      return NextResponse.json({ error: "納品ページの保存期限が過ぎています。期限延長は再送と分けて確認してください。" }, { status: 409 });
    case "not-found":
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    case "no-files":
      return NextResponse.json(
        {
          error:
            kind === "rough"
              ? "ラフ確認用のファイルが未アップロードです"
              : "すべての納品ファイルの保存・取得を確認してください。未確認や取得できないファイルがあります。",
        },
        { status: 400 }
      );
    case "not-configured":
      return NextResponse.json(
        { error: "Mail or Stripe is not configured (RESEND_API_KEY / STRIPE_SECRET_KEY)" },
        { status: 500 }
      );
    case "stripe-error":
      return NextResponse.json({ error: "Failed to create payment link" }, { status: 502 });
    case "mail-error":
      return NextResponse.json({ error: "Failed to send mail" }, { status: 502 });
    case "db-error":
      return NextResponse.json({ error: "Failed to persist mail state" }, { status: 500 });
    case "state-error-after-send":
      return NextResponse.json({
        ok: true,
        warning: "メールは送信済みですが、案件状態の更新に失敗しました。再送せず管理者へ確認してください。",
        paymentLinkUrl: result.paymentLinkUrl ?? null,
      });
    case "invalid-state":
      return NextResponse.json(
        { error: "現在の案件状態ではこのメールを送信できません。画面を再読み込みしてください。" },
        { status: 409 }
      );
    case "quote-not-accepted":
      return NextResponse.json(
        { error: "承諾済みの最新見積もりがありません。先に見積もり承諾を確認してください。" },
        { status: 409 }
      );
    case "amount-mismatch":
      return NextResponse.json(
        { error: "支払い金額が承諾済み見積もりと一致しません。" },
        { status: 409 }
      );
    case "already-paid":
      return NextResponse.json(
        { error: "この案件は入金確認済みのため、新しい支払いリンクは発行できません。" },
        { status: 409 }
      );
    case "ok":
      return NextResponse.json({ ok: true, paymentLinkUrl: result.paymentLinkUrl ?? null,
        ...(result.releaseId ? { releaseId: result.releaseId, notificationStatus: result.notificationStatus,
          warning: result.notificationStatus !== "sent" ? "納品内容は保存されています。メールの送信状況は管理ホームの通知欄で確認・再試行してください。納品や受取の記録は維持されています。" : undefined } : {}),
      });
  }
});
