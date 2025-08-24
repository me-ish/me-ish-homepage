import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('[webhook] signature verification failed:', err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    console.log('[webhook] session.completed', session.id, session.payment_status);

    // 支払い済みだけ処理
    if (session.payment_status !== 'paid') {
      console.log('[webhook] skip unpaid session', session.id, session.payment_status);
      return NextResponse.json({ received: true });
    }

    const entryId = Number(session.metadata?.entryId);
    const qty = Math.max(1, Number(session.metadata?.quantity ?? 1));

    if (!entryId || Number.isNaN(qty)) {
      console.warn('[webhook] missing metadata', session.id, session.metadata);
      return NextResponse.json({ received: true });
    }

    // 原子的インクリメント（RPC 側で FOR UPDATE & 在庫チェック）
    const { data, error } = await supabaseAdmin.rpc('finalize_sale', {
      p_entry_id: entryId,
      p_quantity: qty,
      p_session_id: session.id, // ← RPC 側で sales の一意制約に使うならこのまま
    });

    if (error) {
      const msg = `${error.message || error}`;
      console.error('[webhook] finalize_sale error:', msg);

      // 二重配信で sales の一意制約に引っかかった場合は無害化
      if (msg.includes('duplicate key value') || msg.includes('already processed')) {
        return NextResponse.json({ received: true });
      }

      // 在庫超過（RPCが "sold out" を投げる想定）
      if (msg.toLowerCase().includes('sold out')) {
        // ここで必要なら自動返金:
        // if (session.payment_intent) await stripe.refunds.create({ payment_intent: session.payment_intent as string });
        return NextResponse.json({ error: 'sold out' }, { status: 409 });
      }

      return NextResponse.json({ error: 'finalize failed' }, { status: 400 });
    }

    console.log('[webhook] edition_sold updated ->', data);
    return NextResponse.json({ ok: true });
  }

  // 他イベントは受領だけ
  console.log('[webhook] ignored event:', event.type);
  return NextResponse.json({ received: true });
}
