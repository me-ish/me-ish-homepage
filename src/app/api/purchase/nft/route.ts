// /src/app/api/purchase/nft/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// 読み取りはサーバー側で（RLS事情に応じて service role を使用）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { entryId } = await req.json();

  if (!entryId) {
    return NextResponse.json({ error: 'entryId is required' }, { status: 400 });
  }

  // 価格・タイトル・在庫をサーバーで確定（改ざん防止）
  const { data: entry, error } = await supabaseAdmin
    .from('entries')
    .select('id, title, price, edition_total, edition_sold, is_nft')
    .eq('id', entryId)
    .single();

  if (error || !entry) {
    return NextResponse.json({ error: 'entry not found' }, { status: 404 });
  }

  // NFTエディションは1回の決済で1点に固定（複数可にするならここを調整）
  const qty = 1;

  // 在庫プレチェック（最終確定は Webhook/RPC）
  const total = entry.edition_total ?? null;
  const sold  = entry.edition_sold ?? 0;
  const remaining = total === null ? Infinity : Math.max(0, total - sold);
  if (total !== null && qty > remaining) {
    return NextResponse.json({ error: 'sold out' }, { status: 409 });
  }

  const unitAmount = Math.max(1, Math.floor(Number(entry.price ?? 0))); // JPYは整数（ゼロ小数）

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'jpy',
        product_data: { name: `me-ish NFT作品：${entry.title}` },
        unit_amount: unitAmount,
      },
      quantity: qty,
    }],
    locale: 'ja',
    // 成果処理は Webhook に集約。success は画面遷移のみ
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/purchase/cancel`,
    metadata: {
      type: 'nft',                 // ← ここでNFT購入だと分かる
      entryId: String(entry.id),
      quantity: String(qty),
    },
    client_reference_id: `nft:${entry.id}`,
  });

  return NextResponse.json({ url: session.url });
}
