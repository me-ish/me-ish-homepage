// src/app/api/purchase/success/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil' as const,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session_id');
  const entryId = searchParams.get('entryId');

  if (!sessionId || !entryId) {
    console.error('パラメータ不足: session_id または entryId がありません');
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/purchase/error`);
  }

  try {
    // ✅ Stripeセッション取得（名前・メール・金額・metadataを取得）
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // ✅ 1. entriesテーブルの is_sold を true に更新
    const { error: updateError } = await supabase
      .from('entries')
      .update({ is_sold: true })
      .eq('id', Number(entryId));

    if (updateError) {
      console.error('entries更新エラー:', updateError.message);
    }

    // ✅ 2. sales テーブルに購入情報を記録
    const { error: insertError } = await supabase.from('sales').insert([
      {
        entry_id: Number(entryId),
        stripe_session_id: sessionId,
        buyer_email: session.customer_details?.email ?? '',
        price: session.amount_total ? Math.floor(session.amount_total / 100) : null,
        purchased_at: new Date().toISOString(),
        metadata: session.metadata ? JSON.parse(JSON.stringify(session.metadata)) : {},
      },
    ]);

    if (insertError) {
      console.error('sales登録エラー:', insertError.message);
    }

    // ✅ 3. 購入者にメール通知
    if (session.customer_details?.email) {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/send-email/purchase-buyer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: session.customer_details.email,
          name: session.customer_details.name || 'お客様',
        }),
      });
    }

    // ✅ 最終的に成功画面へリダイレクト
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/purchase/success?entryId=${entryId}`
    );
  } catch (err: any) {
    console.error('Stripe処理エラー:', err.message);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/purchase/error`);
  }
}
