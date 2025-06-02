// src/app/api/purchase/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil', // エラー回避のため明示
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, price, entryId } = body;

  if (!title || !price || !entryId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      currency: 'jpy',
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            unit_amount: Number(price),
            product_data: {
              name: `me-ish作品：${title}`,
            },
          },
          quantity: 1,
        },
      ],
      // ✅ session_idを含めたリダイレクトURL（重要）
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/purchase/success?session_id={CHECKOUT_SESSION_ID}&entryId=${entryId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/purchase/cancel`,
      metadata: {
        entryId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Stripeセッション作成エラー:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

