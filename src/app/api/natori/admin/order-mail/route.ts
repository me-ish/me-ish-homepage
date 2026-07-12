// api/natori/admin/order-mail/route.ts
// ダッシュボードから依頼者へ見積もりメール / 支払い依頼メールを送る。
// 業務ロジックは orderMailService に集約（route は薄く）。
import { NextResponse } from "next/server";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import { sendNatoriOrderMail } from "@/features/natori/server/orderMailService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    kind?: unknown;
    projectId?: unknown;
    to?: unknown;
    subject?: unknown;
    body?: unknown;
    amount?: unknown;
  } | null;
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const kind = payload.kind;
  if (kind !== "estimate" && kind !== "payment") {
    return NextResponse.json({ error: "kind must be estimate or payment" }, { status: 400 });
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

  const result = await sendNatoriOrderMail({ kind, projectId, to, subject, body, amount });
  switch (result.kind) {
    case "not-found":
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
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
      // メール自体は送信済み。案件更新だけ失敗したことを呼び出し側へ伝える
      return NextResponse.json(
        { ok: true, warning: "mail sent but project update failed" },
        { status: 200 }
      );
    case "ok":
      return NextResponse.json({ ok: true, paymentLinkUrl: result.paymentLinkUrl ?? null });
  }
}
