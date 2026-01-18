// src/app/api/aura/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ✅ 所有権チェック（Cookie aura_st_{requestId}）
import { requireAuraRequestAccess } from "@/lib/aiPortfolio/requireAuraAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function baseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL!;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function GET(req: NextRequest) {
  const requestId = req.nextUrl.searchParams.get("requestId");
  if (!requestId) {
    return NextResponse.json({ ok: false, error: "missing_requestId" }, { status: 400 });
  }

  // ✅ IDOR遮断：本人の requestId であることを Cookie で検証
  const access = await requireAuraRequestAccess(requestId);
  if (!access.ok) return access.response;

  const admin = supabaseAdmin();

  // ✅ 型定義に aura_requests が無い環境でも通す
  const { data: rec, error } = await (admin as any)
    .from("aura_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (error || !rec) {
    // ※ details を返すと情報露出が増えるので、ここでは固定文言に寄せる
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const paymentStatus = String((rec as any).payment_status ?? "unpaid").toLowerCase();

  // すでに支払い済みなら、そのまま戻す（無駄な再決済を防ぐ）
  if (paymentStatus === "paid") {
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

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: (rec as any).email || undefined,

    // webhook で識別できるように kind を入れる（既存の entryId 方式と衝突させない）
    metadata: {
      kind: "aura",
      requestId: String((rec as any).id),
      email: (rec as any).email || "",
    },

    // ✅ 任意だが推奨：Stripe側でも参照しやすい（ダッシュボード上の追跡が楽）
    client_reference_id: String((rec as any).id),
  });

  if (!session.url) {
    return NextResponse.json({ ok: false, error: "stripe_session_no_url" }, { status: 500 });
  }

  return NextResponse.redirect(session.url, { status: 303 });
}
