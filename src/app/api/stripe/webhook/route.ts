// src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createHash, randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// CoAリンクの有効期限（分）。未設定は30日（60*24*30）
const CERT_LINK_TTL_MINUTES = Number(process.env.CERT_LINK_TTL_MINUTES || 60 * 24 * 30);

const Meta = z.object({
  entryId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().default(1),
  type: z.string().optional(), // 'nft' or 'normal'
});

function baseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL!;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

// cert_links にトークンを保存して、表示用の生トークンを返す
async function createCertToken(entryId: number) {
  const token = randomUUID().replace(/-/g, '');
  const token_hash = createHash('sha256').update(token).digest('hex');
  const expires_at = new Date(Date.now() + CERT_LINK_TTL_MINUTES * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin()
    .from('cert_links')
    .insert({ entry_id: entryId, token_hash, expires_at, revoked: false });

  if (error) throw error;
  return token;
}

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

    const parsed = Meta.safeParse(session.metadata || {});
    if (!parsed.success) return NextResponse.json({ received: true });
    const { entryId, quantity, type } = parsed.data;

    try {
      const admin = supabaseAdmin();

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

      const { data: entryRow } = await admin
        .from('entries')
        .select('title, artist_name, edition_total, email')
        .eq('id', entryId)
        .single();

      let receiptUrl: string | undefined;
      if (session.payment_intent) {
        const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string, {
          expand: ['latest_charge'],
        });
        const ch = (pi.latest_charge as any);
        receiptUrl = ch?.receipt_url;
      }

      const edition_from = (result as any)?.edition_from ?? null;
      const editionNo = edition_from ?? null;
      const editionTotal = entryRow?.edition_total ?? null;

      const totalYen =
        typeof session.amount_total === 'number' ? session.amount_total : null;

      const buyerEmail =
        session.customer_details?.email || session.customer_email || undefined;
      const buyerName = session.customer_details?.name || 'お客様';

      if (buyerEmail) {
        let certificateUrl: string | undefined;
        try {
          const t = await createCertToken(entryId);
          const params = new URLSearchParams({ t });

          // ★ type が normal の場合は type=normal を明示し、entry/title/artist も渡す
          if (type === 'normal') {
            params.set('type', 'normal');
            params.set('entry', String(entryId));
            if (entryRow?.title) params.set('title', entryRow.title);
            if (entryRow?.artist_name) params.set('artist', entryRow.artist_name);
          } else {
            // NFT想定: tokenId や qty は将来ここで付与
            params.set('type', 'nft');
          }

          certificateUrl = `${baseUrl()}/cert/${entryId}?${params.toString()}`;
        } catch (e) {
          console.error('[webhook] cert token create failed:', e);
        }

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
            priceYen: totalYen,
            editionNo,
            editionTotal,
            orderId: session.id,
            receiptUrl,
            certificateUrl,
          }),
        });
      }

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
            amountYen: totalYen,
          }),
        });
      }

      console.log('[webhook] finalized & mailed:', {
        entryId,
        quantity,
        session: session.id,
      });
      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error('[webhook] fatal:', e);
      return NextResponse.json({ error: 'internal error' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
