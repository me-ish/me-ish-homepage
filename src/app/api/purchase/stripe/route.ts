// src/app/api/purchase/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { checkCsrf } from '@/lib/auth/csrf';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const csrfErr = checkCsrf(req);
  if (csrfErr) return csrfErr;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { entryId, quantity = 1 } = body;

  if (!entryId || (typeof entryId !== 'string' && typeof entryId !== 'number')) {
    return NextResponse.json({ error: 'entryId is required' }, { status: 400 });
  }

  // 価格・在庫をサーバー側で確定（改ざん防止）
  const { data: entry, error } = await supabaseAdmin()
    .from('entries')
    .select('id, title, price, edition_total, edition_sold')
    .eq('id', Number(entryId))
    .single();

  if (error || !entry) {
    return NextResponse.json({ error: 'entry not found' }, { status: 404 });
  }

  const unitAmount = Math.max(1, Math.floor(Number(entry.price ?? 0)));

  // 簡易在庫チェック（最終反映は Webhook/RPC で）
  const total = entry.edition_total ?? null;
  const sold  = entry.edition_sold ?? 0;
  const remaining = total === null ? Infinity : Math.max(0, total - sold);

  const qty = Math.max(1, Math.min(Number(quantity) || 1, remaining));
  if (total !== null && qty > remaining) {
    return NextResponse.json({ error: 'sold out' }, { status: 409 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'jpy',
        product_data: { name: `me-ish作品：${entry.title}` },
        unit_amount: unitAmount,
      },
      quantity: qty,
    }],
    // DB更新は Webhook に集約。success は画面遷移だけでOK
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/purchase/cancel`,
    metadata: {
      entryId: String(entry.id),
      quantity: String(qty),
    },
    client_reference_id: String(entry.id),
  });

  return NextResponse.json({ url: session.url });
}


