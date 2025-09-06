import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function baseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL!;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // 1) 対象エントリを取得（移動元パスやメール送信用の値を取る）
  const { data: entry, error: selErr } = await admin
    .from('entries')
    .select('id, file_name, image_url, email, artist_name, external_user_id, title, gallery_type')
    .eq('id', id)
    .single();

  if (selErr || !entry) {
    return NextResponse.json({ error: selErr?.message || 'not_found' }, { status: 404 });
  }

  // 2) Storage を pending-processing/ に移動（同一バケット内）
  //    すでに pending-processing/ 配下ならスキップ
  let nextFileName = entry.file_name || null;
  let nextImageUrl = entry.image_url || null;

  if (entry.file_name && !entry.file_name.startsWith('pending-processing/')) {
    const fromPath = entry.file_name;
    const toPath = `pending-processing/${entry.file_name}`;

    const { error: mvErr } = await admin.storage.from('artworks').move(fromPath, toPath);

    if (mvErr) {
      // 既に存在などの軽微エラーは許容（必要に応じてメッセージ条件を広げてください）
      const msg = (mvErr as any)?.message || String(mvErr);
      if (!/already exists|exists/i.test(msg)) {
        console.error('[approve] storage move failed:', mvErr);
        return NextResponse.json({ error: `move_failed: ${msg}` }, { status: 500 });
      }
    }

    nextFileName = toPath;

    // バケットが public の場合は新パスの public URL を再生成して保存
    const { data: pub } = admin.storage.from('artworks').getPublicUrl(toPath);
    if (pub?.publicUrl) {
      nextImageUrl = pub.publicUrl;
    }
  }

  // 3) DB 更新（承認フラグ＋移動後のパス/URLを反映、処理キュー印など）
  const patch: any = {
    confirmed: true,
    confirmed_at: new Date().toISOString(),
    processed: false,        // これから加工するフラグ
    ...(nextFileName ? { file_name: nextFileName } : {}),
    ...(nextImageUrl ? { image_url: nextImageUrl } : {}),
  };

  const { data: updated, error: updErr } = await admin
    .from('entries')
    .update(patch)
    .eq('id', id)
    .select('id, email, artist_name, external_user_id, confirmed, confirmed_at, title, image_url, gallery_type, file_name')
    .single();

  if (updErr || !updated) {
    return NextResponse.json({ error: updErr?.message || 'update_failed' }, { status: 500 });
  }

  // 4) 承認メール送信（失敗しても承認は維持）
  try {
    const resp = await fetch(`${baseUrl()}/api/send-email/pass`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-meish-admin-token': process.env.ADMIN_API_TOKEN!, // 内部API認証
      },
      body: JSON.stringify({
        to: updated.email,
        name: updated.artist_name,
        externalUserId: updated.external_user_id,
        // siteUrl 等を上書きしたい場合はここに追加
      }),
      cache: 'no-store',
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      console.error('[approve] pass mail not ok:', resp.status, t);
    }
  } catch (e) {
    console.error('[approve] pass mail failed:', e);
  }

  return NextResponse.json(updated, { status: 200 });
}

