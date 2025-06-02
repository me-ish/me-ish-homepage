// src/app/api/purchase/nft/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil',
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, price, entryId, tokenId } = body;

  if (!title || !price || !entryId || !tokenId) {
    return NextResponse.json({ error: '必要な情報が不足しています' }, { status: 400 });
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
              name: `me-ish NFT作品：${title}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/purchase/success/nft-transfer?session_id={CHECKOUT_SESSION_ID}&entryId=${entryId}&tokenId=${tokenId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/purchase/cancel`,
      metadata: {
        entryId,
        tokenId,
        type: 'nft',
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('NFT購入用Stripeセッション作成エラー:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
