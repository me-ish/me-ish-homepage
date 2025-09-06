// src/app/admin/api/entries/[id]/approve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function baseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL!;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  // 1) 承認フラグ更新 & 送信用データ取得
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('entries')
    .update({
      confirmed: true,
      confirmed_at: new Date().toISOString(),
      // 他に必要な更新があればここに
    })
    .eq('id', id)
    .select('id, email, artist_name, external_user_id, confirmed, confirmed_at, title, image_url, gallery_type')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'update failed' }, { status: 500 });
  }

  // 2) 承認メール送信（失敗しても承認自体は維持）
  try {
    await fetch(`${baseUrl()}/api/send-email/pass`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-meish-admin-token': process.env.ADMIN_API_TOKEN!, // 内部API認証
      },
      body: JSON.stringify({
        to: data.email,
        name: data.artist_name,
        externalUserId: data.external_user_id,
        // 必要に応じて上書き
        // siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        // supportEmail: 'support@me-ish.art',
      }),
      cache: 'no-store',
    });
  } catch (e) {
    console.error('[approve] pass mail failed:', e);
    // ここで 500 にせず、承認は成功として返す（必要ならログだけ）
  }

  return NextResponse.json(data, { status: 200 });
}
