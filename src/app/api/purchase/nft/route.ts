// /src/app/api/purchase/nft/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // 使っているバージョンに合わせてOK（未指定でも可）
  // apiVersion: '2024-06-20' as any,
});

const Body = z.object({
  entryId: z.union([z.string(), z.number()]),
});

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');

function httpUrl(u: string): string | null {
  try {
    const url = new URL(u);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  // ---- 入力バリデーション
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'entryId is required' }, { status: 400 });
  }
  const entryId = Number(parsed.data.entryId);
  if (!Number.isInteger(entryId) || entryId <= 0) {
    return NextResponse.json({ error: 'invalid entryId' }, { status: 400 });
  }

  // ---- サーバ側で販売可否を厳密チェック
  const admin = supabaseAdmin();
  const { data: entry, error } = await admin
    .from('entries')
    .select(
      `
      id, title, price,
      sale_type, is_for_sale, is_sold,
      edition_total, edition_sold,
      confirmed, display_ready,
      display_start_at, display_end_at
      `
    )
    .eq('id', entryId)
    .single();

  if (error || !entry) {
    return NextResponse.json({ error: 'entry not found' }, { status: 404 });
  }

  // 整合チェック：NFTのみに限定
  if (entry.sale_type !== 'nft') {
    return NextResponse.json({ error: 'not nft entry' }, { status: 400 });
  }

  // 公開・販売条件（必要に応じて調整）
  const now = new Date();
  const startOk = !entry.display_start_at || new Date(entry.display_start_at) <= now;
  const endOk = !entry.display_end_at || new Date(entry.display_end_at) > now;
  if (!entry.confirmed || !entry.display_ready || !startOk || !endOk) {
    return NextResponse.json({ error: 'not available for sale' }, { status: 409 });
  }
  if (!entry.is_for_sale || entry.is_sold === true) {
    return NextResponse.json({ error: 'not for sale' }, { status: 409 });
  }

  // 在庫（NFTは基本 1/1 かエディション制を想定）
  const total = entry.edition_total ?? 1;
  const sold = entry.edition_sold ?? 0;
  if (typeof total === 'number' && sold >= total) {
    return NextResponse.json({ error: 'sold out' }, { status: 409 });
  }

  // 価格（Stripe JPYは整数）
  const unitAmount = Math.floor(Number(entry.price ?? 0));
  if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
    return NextResponse.json({ error: 'invalid price' }, { status: 400 });
  }

  // リダイレクト先URL（https のみ許可）
  const success = httpUrl(`${SITE_URL}/purchase/success?session_id={CHECKOUT_SESSION_ID}`);
  const cancel = httpUrl(`${SITE_URL}/purchase/cancel`);
  if (!success || !cancel) {
    return NextResponse.json({ error: 'server misconfig: NEXT_PUBLIC_SITE_URL' }, { status: 500 });
  }

  // 1回の決済で1点
  const qty = 1;

  // ---- Stripe セッション作成（冪等キー付き）
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      locale: 'ja',
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product_data: {
              name: `me-ish NFT作品：${entry.title || `#${entry.id}`}`,
            },
            unit_amount: unitAmount,
          },
          quantity: qty,
        },
      ],
      success_url: success,
      cancel_url: cancel,
      // 成果確定は Webhook 側でDB更新 & ミント起票
      metadata: {
        type: 'nft',
        entryId: String(entry.id),
        quantity: String(qty),
      },
      client_reference_id: `nft:${entry.id}`,
    },
    { idempotencyKey: randomUUID() }
  );

  return NextResponse.json({ url: session.url });
}
