// --- /app/api/webhooks/stripe/route.ts ---
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { mintNftForPurchase } from '@/lib/mintNftForPurchase'; // mint処理を分離

// Stripe初期化
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion,
});

// Webhookシークレット
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  // 生のリクエストボディを取得（Stripe署名検証用）
  const rawBody = await req.text();

  // headers() は Promise なので await が必要
  const sig = (await headers()).get('stripe-signature');

  if (!sig) {
    console.error('Missing stripe-signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    // Stripeの署名検証
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // イベントタイプごとに処理を分岐
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    const email = session.customer_details?.email;
    const metadata = session.metadata;

    if (email && metadata) {
      try {
        await mintNftForPurchase(email, metadata);
        console.log(`NFT minted for ${email}`);
      } catch (err) {
        console.error('Error in mintNftForPurchase:', err);
        return NextResponse.json({ error: 'NFT minting failed' }, { status: 500 });
      }
    } else {
      console.warn('Missing email or metadata in session:', session.id);
    }
  }

  // すべてのイベントで200を返す（Stripeに成功通知）
  return NextResponse.json({ received: true });
}
