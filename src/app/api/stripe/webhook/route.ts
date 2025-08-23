import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// ★サービスロール（Server Only）で Admin クライアント
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new NextResponse('Missing signature', { status: 400 });

  const rawBody = Buffer.from(await req.arrayBuffer());
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    const entryId = Number(session.metadata?.entryId);
    const qty = Number(session.metadata?.quantity ?? 1);

    if (!entryId || isNaN(qty)) {
      console.warn('[webhook] missing metadata', session.id, session.metadata);
      return NextResponse.json({ received: true });
    }

    // 原子的インクリメント
    const { data, error } = await supabaseAdmin.rpc('finalize_sale', {
      p_entry_id: entryId,
      p_quantity: qty,
      p_session_id: session.id,
    });

    if (error) {
      console.error('[webhook] finalize_sale error:', error);
      // ここで在庫超過などのときのハンドリング（任意で自動返金など）
      return NextResponse.json({ error: 'finalize failed' }, { status: 400 });
    }

    console.log('[webhook] edition_sold ->', data);
  }

  return NextResponse.json({ received: true });
}
