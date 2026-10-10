// Stripe signature verification and Natori payment/refund dispatch.
// Retired owner-test products are acknowledged without database/mail effects.
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  claimStripeEvent,
  releaseStripeEvent,
} from "@/lib/stripe/processedEvents";
import { paymentIntegrityEnabled, refundLedgerEnabled, refundLedgerReadEnabled, receiveNatoriPaymentEvent } from "@/features/natori/server/paymentEventService";
import { isNatoriRefundEventType, isExplicitOtherProductRefund } from "@/features/natori/lib/paymentEvent";
import { markNatoriCommissionPaid } from "@/features/natori/server/orderMailService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// 署名検証だけなので apiVersion 指定は必須ではないが、警告回避したい場合は指定しても良い
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function isUuidLike(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook/stripe] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    console.error("[webhook/stripe] missing stripe-signature header");
    return NextResponse.json({ ok: false, error: "missing_signature" }, { status: 400 });
  }

  // 署名検証には raw body が必要
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[webhook/stripe] signature_verification_failed:", message);
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 400 });
  }


  // Refund objects are not Checkout Sessions. Dispatch before the checkout-only early return.
  if (isNatoriRefundEventType(event.type) && refundLedgerReadEnabled()
    && !isExplicitOtherProductRefund(event)) {
    // A paused consumer must not acknowledge an unrecorded refund. Preserve Stripe
    // redelivery; missing metadata remains unclassified until original-payment lookup.
    if (!paymentIntegrityEnabled() || !refundLedgerEnabled()) {
      return NextResponse.json({ ok: false, received: false, result: "refund_consumer_paused" },
        { status: 503, headers: { "Retry-After": "60" } });
    }
    const result = await receiveNatoriPaymentEvent(event);
    return NextResponse.json({ ok: result.status === 200, received: result.status === 200, result: result.result },
      { status: result.status, ...(result.status === 503 ? { headers: { "Retry-After": "60" } } : {}) });
  }

  const isTarget =
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded";

  if (!isTarget) {
    return NextResponse.json({ ok: true, received: true }, { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  const isPaid =
    session.payment_status === "paid" ||
    (session.status === "complete" && session.payment_status !== "unpaid");

  if (!isPaid) {
    return NextResponse.json({ ok: true, received: true }, { status: 200 });
  }

  const kind = String(session.metadata?.kind ?? "");
  const entryId = String(session.metadata?.entryId ?? "");
  // The owner confirmed old-product payments were their own tests. Do not
  // recreate legacy payment/publication data on a delayed Stripe redelivery.
  // Natori must win over stray entry metadata, including rollback mode.
  if (["aura", "card", "entry_plan", "gallery"].includes(kind) ||
    (kind !== "natori_commission" && /^\d+$/.test(entryId))) {
    return NextResponse.json({ ok: true, received: true, result: "legacy_product_retired" }, { status: 200 });
  }

  // イベント単位の dedup。同一 event.id の再送・同時配送は最初の1リクエスト
  // だけが処理権を得る。処理が一時エラーで失敗した経路では releaseStripeEvent で
  // 行を消してから 500 を返し、Stripe の再送でリトライさせる。
  // Natori's durable inbox runs before the shared rollback-mode claim.
  if (paymentIntegrityEnabled() && session.metadata?.kind === "natori_commission") {
    const result = await receiveNatoriPaymentEvent(event);
    return NextResponse.json({ ok: result.status === 200, received: result.status === 200, result: result.result },
      { status: result.status, ...(result.status === 503 ? { headers: { "Retry-After": "60" } } : {}) });
  }

  const claim = await claimStripeEvent(event.id);
  if (claim === "duplicate") {
    return NextResponse.json(
      { ok: true, received: true, deduped: true },
      { status: 200 }
    );
  }
  if (claim === "error") {
    // dedup 行は入っていないので、500 で再送させれば取りこぼさない
    return NextResponse.json({ ok: false, error: "dedup_failed" }, { status: 500 });
  }

  // ナトリのコミッション入金（支払い依頼メールの Payment Link 経由）
  const natoriProjectId = String(session.metadata?.projectId ?? "");
  if (kind === "natori_commission" && natoriProjectId && isUuidLike(natoriProjectId)) {
    return handleNatoriCommissionPayment(event.id, session, natoriProjectId);
  }

  return NextResponse.json({ ok: true, received: true }, { status: 200 });
}

/**
 * ナトリのコミッション入金処理
 * - natori_projects に payment_confirmed_at を記録し rough（作業開始）へ進める
 * - ナトリ宛に入金通知メールを送る
 * - 冪等性: 案件・見積版・入金台帳をDB関数内で原子的に判定・更新
 * - 一時的な DB エラーは claim を解放して 500（Stripe に再送させる）。
 *   対象行なしは恒久エラーなので 200 ACK。
 */
async function handleNatoriCommissionPayment(
  eventId: string,
  session: Stripe.Checkout.Session,
  projectId: string
): Promise<NextResponse> {
  try {
    const result = await markNatoriCommissionPaid(
      projectId,
      session.id,
      session.amount_total,
      session.metadata?.quoteId ?? null
    );
    if (result.kind === "db-error") {
      console.error("[webhook/stripe/natori-commission] mark paid failed:", {
        eventId,
        sessionId: session.id,
        projectId,
        result: result.kind,
      });
      await releaseStripeEvent(eventId);
      return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
    }
    if (result.kind === "not-found") {
      console.error("[webhook/stripe/natori-commission] project not found:", {
        eventId,
        sessionId: session.id,
        projectId,
      });
    }
    if (result.kind === "amount-mismatch") {
      // 恒久エラー扱い（再送されても金額は変わらない）。管理者への要確認
      // 通知とnote への警告は orderMailService 側で実施済み。
      console.error("[webhook/stripe/natori-commission] amount mismatch:", {
        eventId,
        sessionId: session.id,
        projectId,
        amountTotal: session.amount_total,
      });
    }
    if (result.kind === "quote-mismatch") {
      console.error("[webhook/stripe/natori-commission] quote mismatch:", {
        eventId,
        sessionId: session.id,
        projectId,
        quoteId: session.metadata?.quoteId ?? null,
      });
    }
    return NextResponse.json({ ok: true, received: true }, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[webhook/stripe/natori-commission] exception:", {
      eventId,
      sessionId: session.id,
      projectId,
      error: message,
    });
    await releaseStripeEvent(eventId);
    return NextResponse.json({ ok: false, error: "exception" }, { status: 500 });
  }
}

// GET は 405（Webhookは POST のみ）
export async function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed. Stripe webhooks require POST." },
    { status: 405 }
  );
}
