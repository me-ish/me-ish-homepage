// /src/app/api/purchase/success/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/purchase/error`);
  }

  // （任意）存在確認だけして、UIに渡す
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    // paid かどうかはUIで表示用に使う（DBは触らない）
    const qs = new URLSearchParams({ session_id: session.id }).toString();
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/purchase/success?${qs}`
    );
  } catch {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/purchase/error`);
  }
}

