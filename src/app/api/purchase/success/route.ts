// --- /app/api/purchase/success/route.ts ---
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion,
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
    // ✅ Stripeセッション取得
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // ✅ 1. entries の is_sold を true に更新
    const { error: updateError } = await supabase
      .from('entries')
      .update({ is_sold: true })
      .eq('id', Number(entryId));

    if (updateError) {
      console.error('entries更新エラー:', updateError.message);
    }

    // ✅ 2. entries から price を取得 → 手数料 & 報酬を保存
    const { data: entryData, error: fetchError } = await supabase
      .from('entries')
      .select('price')
      .eq('id', Number(entryId))
      .single();

    if (fetchError || !entryData) {
      console.error('価格取得エラー:', fetchError?.message);
    } else {
      const price = Number(entryData.price);
      const fee = Math.round(price * 0.05);
      const reward = price - fee;

      const { error: payoutError } = await supabase
        .from('entries')
        .update({
          meish_fee_yen: fee,
          artist_reward_yen: reward,
          is_paid_to_artist: false,
          paid_at: null,
        })
        .eq('id', Number(entryId));

      if (payoutError) {
        console.error('報酬計算エラー:', payoutError.message);
      }
    }

    // ✅ 3. sales テーブルに購入情報を記録
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

    // ✅ 4. 購入者にメール通知（Resend）
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

    // ✅ 5. 購入完了画面にリダイレクト
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/purchase/success?entryId=${entryId}`
    );
  } catch (err: any) {
    console.error('Stripe処理エラー:', err.message);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/purchase/error`);
  }
}

