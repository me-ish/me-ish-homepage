// src/app/api/purchase/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// 読み取り用。RLS次第では anon でも可だが、確実に行くなら service role を使用
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { entryId, quantity = 1 } = await req.json();

  if (!entryId) {
    return NextResponse.json({ error: 'entryId is required' }, { status: 400 });
  }

  // 価格・在庫をサーバー側で確定（改ざん防止）
  const { data: entry, error } = await supabaseAdmin
    .from('entries')
    .select('id, title, price, edition_total, edition_sold')
    .eq('id', entryId)
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

