// src/app/api/card/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSiteUrl } from "@/lib/constants";
import { requireCardRequestAccess } from "@/lib/card/requireCardAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(req: NextRequest) {
  const requestId = req.nextUrl.searchParams.get("requestId");
  if (!requestId) {
    return NextResponse.json(
      { ok: false, error: "missing_requestId" },
      { status: 400 },
    );
  }

  // IDOR check
  const access = await requireCardRequestAccess(requestId);
  if (!access.ok) return access.response;

  const admin = supabaseAdmin();

  const { data: rec, error } = await admin
    .from("card_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (error || !rec) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 },
    );
  }

  const paymentStatus = String(
    (rec as any).payment_status ?? "unpaid",
  ).toLowerCase();

  if (paymentStatus === "paid") {
    return NextResponse.redirect(
      `${getSiteUrl()}/card/preview/${encodeURIComponent(requestId)}`,
      { status: 303 },
    );
  }

  const priceId = process.env.CARD_STRIPE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json(
      { ok: false, error: "missing_CARD_STRIPE_PRICE_ID" },
      { status: 500 },
    );
  }

  const successUrl = `${getSiteUrl()}/card/preview/${encodeURIComponent(requestId)}?paid=1`;
  const cancelUrl = `${getSiteUrl()}/card/preview/${encodeURIComponent(requestId)}?canceled=1`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: (rec as any).email || undefined,

    metadata: {
      kind: "card",
      requestId: String((rec as any).id),
      email: (rec as any).email || "",
    },

    client_reference_id: String((rec as any).id),
  });

  if (!session.url) {
    return NextResponse.json(
      { ok: false, error: "stripe_session_no_url" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(session.url, { status: 303 });
}
