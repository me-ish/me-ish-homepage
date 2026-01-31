// src/app/receipt/[sessionId]/page.tsx
import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import ReceiptClient from './ReceiptClient';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ sessionId: string }>;
};

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: '領収書 | me-ish',
    robots: { index: false, follow: false },
  };
}

export default async function ReceiptPage({ params }: Props) {
  const { sessionId } = await params;

  // Stripe session IDの形式チェック（cs_で始まる）
  if (!sessionId || !sessionId.startsWith('cs_')) {
    notFound();
  }

  const admin = supabaseAdmin();

  // 売上情報を取得
  const { data: sale, error: saleError } = await admin
    .from('sales')
    .select('id, entry_id, price, buyer_email, purchased_at, stripe_session_id')
    .eq('stripe_session_id', sessionId)
    .maybeSingle();

  if (saleError || !sale) {
    console.error('[receipt] sale not found:', { sessionId, error: saleError });
    notFound();
  }

  // 作品情報を取得
  const { data: entry } = await admin
    .from('entries')
    .select('title, artist_name')
    .eq('id', sale.entry_id)
    .single();

  const receiptData = {
    receiptNo: sale.id.slice(0, 8).toUpperCase(),
    purchasedAt: sale.purchased_at,
    buyerEmail: sale.buyer_email || '—',
    itemTitle: entry?.title || '作品',
    artistName: entry?.artist_name || '—',
    price: sale.price || 0,
    sessionId: sale.stripe_session_id,
  };

  return <ReceiptClient data={receiptData} />;
}
