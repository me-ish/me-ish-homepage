// src/app/api/webhook/stripe/route.ts
// =============================================================================
// Stripe Webhook 統合エンドポイント（Source of Truth）
// - ギャラリー購入（entries）と AURA購入（aura_requests）を両方処理
// - Stripe Dashboard の Webhook 送信先はここ: /api/webhook/stripe
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Service Role で接続（RLS バイパス）
function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env missing");
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

function isUuidLike(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// entries.id は bigint なので数字のみ
function isEntryIdLike(v: string): boolean {
  return /^\d+$/.test(v);
}

/**
 * Stripe Webhook POST（署名検証必須）
 *
 * 対象イベント:
 * - checkout.session.completed
 * - checkout.session.async_payment_succeeded
 *
 * 分岐条件:
 * - AURA: metadata.kind === "aura" && metadata.requestId が UUID
 * - Gallery: metadata.entryId が数字（bigint）
 */
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

  // ログ: event.id と event.type を常に出力
  console.log("[webhook/stripe] event received:", {
    eventId: event.id,
    eventType: event.type,
  });

  // 対象イベントのみ処理
  const isTarget =
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded";

  if (!isTarget) {
    console.log("[webhook/stripe] non-target event, ignored:", event.type);
    return NextResponse.json({ ok: true, received: true }, { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // 支払い完了確認
  const isPaid =
    session.payment_status === "paid" ||
    (session.status === "complete" && session.payment_status !== "unpaid");

  if (!isPaid) {
    console.warn("[webhook/stripe] session not paid, skipped:", {
      eventId: event.id,
      sessionId: session.id,
      payment_status: session.payment_status,
      status: session.status,
    });
    return NextResponse.json({ ok: true, received: true }, { status: 200 });
  }

  const kind = String(session.metadata?.kind ?? "");
  const entryId = String(session.metadata?.entryId ?? "");
  const requestId = String(session.metadata?.requestId ?? "");

  // AURA購入
  if (kind === "aura" && requestId && isUuidLike(requestId)) {
    return handleAuraPurchase(event.id, session, requestId);
  }

  // ギャラリー購入
if (entryId && isEntryIdLike(entryId)) {
  const rawQty = parseInt(session.metadata?.quantity ?? "1", 10);
  const quantity = Math.max(1, Math.min(99, Number.isFinite(rawQty) ? rawQty : 1));
  return handleGalleryPurchase(event.id, session, entryId, quantity); // entryIdはstringのまま
}


  // どちらにも該当しない → 無視（他のCheckoutかもしれない）
  console.warn("[webhook/stripe] unrecognized metadata, ignored:", {
    eventId: event.id,
    sessionId: session.id,
    kind,
    entryId,
    requestId,
  });
  return NextResponse.json({ ok: true, received: true }, { status: 200 });
}

/**
 * AURA購入処理
 * - aura_requests.payment_status を paid に更新
 * - 冪等性: 既に paid なら何もしない
 */
async function handleAuraPurchase(
  eventId: string,
  session: Stripe.Checkout.Session,
  requestId: string
): Promise<NextResponse> {
  const admin = supabaseAdmin();

  try {
    // 冪等性チェック: 既に paid なら何もしない
    const { data: rec, error: selErr } = await admin
      .from("aura_requests")
      .select("id, payment_status, stripe_session_id")
      .eq("id", requestId)
      .maybeSingle();

    if (selErr || !rec) {
      console.error("[webhook/stripe/aura] request not found:", {
        eventId,
        sessionId: session.id,
        requestId,
        error: selErr,
      });
      // 見つからなくても 200（Stripe再送ループ回避）
      return NextResponse.json({ ok: true, received: true }, { status: 200 });
    }

    const alreadyPaid = String(rec.payment_status ?? "").toLowerCase() === "paid";
    if (alreadyPaid) {
      console.log("[webhook/stripe/aura] already paid, skipped:", {
        eventId,
        sessionId: session.id,
        requestId,
      });
      return NextResponse.json({ ok: true, received: true }, { status: 200 });
    }

    // 更新
    const { error: updErr } = await admin
      .from("aura_requests")
      .update({
        payment_status: "paid",
        stripe_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updErr) {
      console.error("[webhook/stripe/aura] update failed:", {
        eventId,
        sessionId: session.id,
        requestId,
        error: updErr,
      });
      // 200返す（Stripe再送で復旧の可能性）
      return NextResponse.json({ ok: true, received: true }, { status: 200 });
    }

    console.log("[webhook/stripe/aura] SUCCESS - marked as paid:", {
      eventId,
      sessionId: session.id,
      requestId,
    });
    return NextResponse.json({ ok: true, received: true }, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[webhook/stripe/aura] exception:", {
      eventId,
      sessionId: session.id,
      requestId,
      error: message,
    });
    return NextResponse.json({ ok: true, received: true }, { status: 200 });
  }
}

/**
 * ギャラリー購入処理
 * - finalize_sale RPC で原子的に edition_sold を加算
 * - sales テーブルに記録（冪等性キー: stripe_session_id）
 */
async function handleGalleryPurchase(
  eventId: string,
  session: Stripe.Checkout.Session,
  entryId: string, // bigint文字列
  quantity: number
): Promise<NextResponse> {

  const admin = supabaseAdmin();

  try {
    // 冪等性チェック: sales テーブルに同じ session_id があれば処理済み
    const { data: existing, error: checkErr } = await admin
      .from("sales")
      .select("id")
      .eq("stripe_session_id", session.id)
      .maybeSingle();

    if (checkErr) {
      console.error("[webhook/stripe/gallery] idempotency check failed:", {
        eventId,
        sessionId: session.id,
        error: checkErr,
      });
      // エラーでも処理続行（最悪二重挿入はUNIQUE制約で防ぐ）
    }

    if (existing) {
      console.log("[webhook/stripe/gallery] already processed, skipped:", {
        eventId,
        sessionId: session.id,
        entryId: entryId.toString(),
      });
      return NextResponse.json({ ok: true, received: true }, { status: 200 });
    }

    // finalize_sale RPC で原子的に edition_sold を加算
    // 引数: p_entry_id bigint, p_quantity integer, p_session_id text
const { data: rpcResult, error: rpcErr } = await admin.rpc("finalize_sale", {
  p_entry_id: entryId,        // ← stringでOK（bigintとして解釈される）
  p_quantity: quantity,
  p_session_id: session.id,
});

    if (rpcErr) {
      console.error("[webhook/stripe/gallery] finalize_sale RPC failed:", {
        eventId,
        sessionId: session.id,
        entryId: entryId.toString(),
        quantity,
        error: rpcErr,
      });
      // RPCエラー（sold outなど）でも200を返す
      // sales には記録しない（sold out の場合は手動対応が必要）
      return NextResponse.json({ ok: true, received: true }, { status: 200 });
    }

    // sales テーブルに記録（冪等性のキーとして stripe_session_id を保存）
    const buyerEmail = session.customer_details?.email ?? session.customer_email ?? null;
    const price = session.amount_total ?? null;

const { error: upsertErr } = await admin
  .from("sales")
  .upsert(
    {
      entry_id: entryId,
      stripe_session_id: session.id,
      buyer_email: buyerEmail,
      price: price,
      purchased_at: new Date().toISOString(),
      metadata: {
        event_id: eventId,
        quantity,
        session_status: session.status,
        payment_status: session.payment_status,
        rpc_result: rpcResult,
      },
    },
    { onConflict: "stripe_session_id" }
  );

if (upsertErr) {
  console.error("[webhook/stripe/gallery] sales upsert failed:", {
    eventId,
    sessionId: session.id,
    error: upsertErr,
  });
}

    // 成功ログ
    const newSold = Array.isArray(rpcResult) && rpcResult[0]
      ? rpcResult[0].new_edition_sold
      : "unknown";
    const soldOut = Array.isArray(rpcResult) && rpcResult[0]
      ? rpcResult[0].sold_out
      : false;

    console.log("[webhook/stripe/gallery] SUCCESS - purchase recorded:", {
      eventId,
      sessionId: session.id,
      entryId: entryId.toString(),
      quantity,
      newEditionSold: newSold,
      soldOut,
    });

    return NextResponse.json({ ok: true, received: true }, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[webhook/stripe/gallery] exception:", {
      eventId,
      sessionId: session.id,
      entryId: entryId.toString(),
      error: message,
    });
    return NextResponse.json({ ok: true, received: true }, { status: 200 });
  }
}

// GET は 405 を返す（Webhookは POST のみ）
export async function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed. Stripe webhooks require POST." },
    { status: 405 }
  );
}
