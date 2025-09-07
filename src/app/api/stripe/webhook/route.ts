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

function baseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL!;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new NextResponse('Missing signature', { status: 400 });

  // 生ボディ必須
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

  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const paid = session.payment_status === 'paid';
    if (!paid) return NextResponse.json({ received: true });

    // メタデータ
    const parsed = Meta.safeParse(session.metadata || {});
    if (!parsed.success) return NextResponse.json({ received: true });
    const { entryId, quantity } = parsed.data;

    try {
      const admin = supabaseAdmin();

      // 原子的に在庫確定 + sales作成（重複セッションは UNIQUE で弾く想定）
      const { data: result, error } = await admin.rpc('finalize_sale', {
        p_entry_id: entryId,
        p_quantity: quantity,
        p_session_id: session.id,
      });

      if (error) {
        if (error.code === '23505' || String(error.message).includes('duplicate')) {
          console.log('[webhook] duplicate session handled:', session.id);
          return NextResponse.json({ received: true });
        }
        if (String(error.message).toLowerCase().includes('sold out')) {
          console.warn('[webhook] sold out:', entryId, 'session:', session.id);
          return NextResponse.json({ error: 'sold out' }, { status: 409 });
        }
        console.error('[webhook] finalize_sale error:', error);
        return NextResponse.json({ error: 'finalize failed' }, { status: 400 });
      }

      // 作品情報（メールに使う）
      const { data: entryRow } = await admin
        .from('entries')
        .select('title, artist_name, edition_total, email')
        .eq('id', entryId)
        .single();

      // 領収書URL
      let receiptUrl: string | undefined;
      if (session.payment_intent) {
        const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string, { expand: ['latest_charge'] });
        const ch = (pi.latest_charge as any);
        receiptUrl = ch?.receipt_url;
      }

      // edition の割当（RPCが返す場合を優先）
      const edition_from = (result as any)?.edition_from ?? null;
      const edition_to   = (result as any)?.edition_to ?? null;
      const editionNo    = edition_from ?? null;
      const editionTotal = entryRow?.edition_total ?? null;

      // 合計金額（税・送料込みの合計）— 表示用にはこれで十分
      const totalYen = typeof session.amount_total === 'number' ? session.amount_total : null;

      // 送信：購入者
      const buyerEmail = session.customer_details?.email || session.customer_email || undefined;
      const buyerName  = session.customer_details?.name  || 'お客様';

      if (buyerEmail) {
        await fetch(`${baseUrl()}/api/send-email/purchaseBuyer`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-meish-admin-token': process.env.ADMIN_API_TOKEN!,
          },
          body: JSON.stringify({
            to: buyerEmail,
            name: buyerName,
            title: entryRow?.title,
            artistName: entryRow?.artist_name,
            priceYen: totalYen,                 // ← priceYen/amountYen どちらでもOK（送信側で正規化済み）
            editionNo,
            editionTotal,
            orderId: session.id,
            receiptUrl,
          }),
        });
      }

      // 送信：アーティスト（メールアドレスがある場合）
      if (entryRow?.email) {
        await fetch(`${baseUrl()}/api/send-email/purchaseArtist`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-meish-admin-token': process.env.ADMIN_API_TOKEN!,
          },
          body: JSON.stringify({
            to: entryRow.email,
            name: entryRow.artist_name || 'アーティスト',
            title: entryRow.title,
            amountYen: totalYen,                // ← こちらも正規化される
          }),
        });
      }

      console.log('[webhook] finalized & mailed:', { entryId, quantity, session: session.id });
      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error('[webhook] fatal:', e);
      return NextResponse.json({ error: 'internal error' }, { status: 500 });
    }
  }

  // 他イベントは受領のみ
  return NextResponse.json({ received: true });
}
