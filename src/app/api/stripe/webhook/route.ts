// src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const Meta = z.object({
  entryId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().default(1),
  type: z.string().optional(), // 'nft' など（任意）
});

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new NextResponse('Missing signature', { status: 400 });

  // Stripe署名検証は「生のボディ」が必須
  const rawBody = Buffer.from(await req.arrayBuffer());

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('[webhook] signature verification failed:', err?.message || err);
    return new NextResponse(`Webhook Error: ${err?.message || 'invalid'}`, { status: 400 });
  }

  // 同等の完了イベントを許容（支払い手段によっては async）
  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const paid = session.payment_status === 'paid';
    if (!paid) {
      console.log('[webhook] skip unpaid session', session.id, session.payment_status);
      return NextResponse.json({ received: true });
    }

    // メタデータ検証
    const parsed = Meta.safeParse(session.metadata || {});
    if (!parsed.success) {
      console.warn('[webhook] missing/invalid metadata', session.id, session.metadata);
      return NextResponse.json({ received: true }); // 通知は成功扱いで終了
    }
    const { entryId, quantity } = parsed.data;

    try {
      const admin = supabaseAdmin();

      // 原子的に在庫確定 + sales作成（RPC側で一意制約 stripe_session_id を使う想定）
      const { data, error } = await admin.rpc('finalize_sale', {
        p_entry_id: entryId,
        p_quantity: quantity,
        p_session_id: session.id,
      });

      if (error) {
        // 二重配信・重複キーはOK扱い
        if (error.code === '23505' || String(error.message).includes('duplicate')) {
          console.log('[webhook] duplicate session handled:', session.id);
          return NextResponse.json({ received: true });
        }
        // 在庫超過など業務エラー（RPCがメッセージを投げる想定）
        if (String(error.message).toLowerCase().includes('sold out')) {
          console.warn('[webhook] sold out:', entryId, 'session:', session.id);
          // 必要なら自動返金ロジックをここに（payment_intent ありの場合）
          // if (session.payment_intent) await stripe.refunds.create({ payment_intent: session.payment_intent as string });
          return NextResponse.json({ error: 'sold out' }, { status: 409 });
        }
        console.error('[webhook] finalize_sale error:', error);
        return NextResponse.json({ error: 'finalize failed' }, { status: 400 });
      }

      console.log('[webhook] finalized:', { entryId, quantity, result: data });
      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error('[webhook] fatal:', e);
      return NextResponse.json({ error: 'internal error' }, { status: 500 });
    }
  }

  // 他のイベントは受領のみ
  console.log('[webhook] ignored event:', event.type);
  return NextResponse.json({ received: true });
}
