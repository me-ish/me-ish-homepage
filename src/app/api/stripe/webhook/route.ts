// src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function baseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL!;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function isUuidLike(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(req: NextRequest) {
  const requestId = req.nextUrl.searchParams.get("requestId");
  if (!requestId) {
    return NextResponse.json({ ok: false, error: "missing_requestId" }, { status: 400 });
  }
  if (!isUuidLike(requestId)) {
    return NextResponse.json({ ok: false, error: "invalid_requestId" }, { status: 400 });
  }

  // ✅ ここが重要：型定義が追いついてないので any で回避
  const admin = supabaseAdmin() as any;

  // ⚠️ ここで選択している列がDBに存在しないと実行時エラーになります（下にSQLあり）
  const { data: rec, error } = await admin
    .from("aura_requests")
    .select("id, email, payment_status, stripe_session_id")
    .eq("id", requestId)
    .maybeSingle();

  if (error || !rec) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  // すでに支払い済みなら、そのまま戻す（無駄な再決済を防ぐ）
  if (String(rec.payment_status || "").toLowerCase() === "paid") {
    return NextResponse.redirect(
      `${baseUrl()}/aura/preview/${encodeURIComponent(requestId)}`,
      { status: 303 },
    );
  }

  const priceId = process.env.AURA_STRIPE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ ok: false, error: "missing_AURA_STRIPE_PRICE_ID" }, { status: 500 });
  }

  const successUrl = `${baseUrl()}/aura/preview/${encodeURIComponent(requestId)}?paid=1`;
  const cancelUrl = `${baseUrl()}/aura/preview/${encodeURIComponent(requestId)}?canceled=1`;

  // 既に作ったCheckoutがあれば再利用（stripe_session_id列がある場合のみ）
  if (rec.stripe_session_id) {
    try {
      const s = await stripe.checkout.sessions.retrieve(rec.stripe_session_id);
      if (s?.url) return NextResponse.redirect(s.url, { status: 303 });
    } catch {
      // 無効なら作り直す
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: rec.email || undefined,
    metadata: {
      kind: "aura",
      requestId: String(rec.id),
      email: rec.email || "",
    },
  });

  if (!session.url) {
    return NextResponse.json({ ok: false, error: "stripe_session_url_missing" }, { status: 500 });
  }

  // session_id保存（stripe_session_id列がある場合のみ。無くても決済は進める）
  try {
    await admin
      .from("aura_requests")
      .update({ stripe_session_id: session.id })
      .eq("id", requestId);
  } catch {
    // ignore
  }

  return NextResponse.redirect(session.url, { status: 303 });
}
