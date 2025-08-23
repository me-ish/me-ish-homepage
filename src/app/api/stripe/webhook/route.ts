// /src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { mintNftForPurchase } from '@/lib/mintNftForPurchase';

export const runtime = 'nodejs'; // 署名検証のためEdge不可

// ← これが無いと「'stripe' が見つかりません」になる
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new NextResponse('Missing signature', { status: 400 });

  // raw body（文字コード変換なし）
  const rawBody = Buffer.from(await req.arrayBuffer());

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    console.log('✅ checkout.session.completed:', session.id);

    const email = session.customer_details?.email ?? null;
    const metadata = session.metadata ?? null;

    if (email && metadata) {
      try {
        await mintNftForPurchase(email, metadata);
      } catch (e) {
        console.error('mintNftForPurchase error:', e);
        return NextResponse.json({ error: 'NFT minting failed' }, { status: 500 });
      }
    }
  } else {
    console.log('ℹ️ received event:', event.type);
  }

  return NextResponse.json({ received: true });
}
