// src/app/admin/api/entries/[id]/approve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function baseUrl() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL!;
  }
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

  const admin = supabaseAdmin();

  // 0) 対象取得（メール/作家名/ファイル名など）
  const { data: entry, error: selErr } = await admin
    .from('entries')
    .select(
      'id, artist_name, email, external_user_id, title, gallery_type, file_name, image_url'
    )
    .eq('id', id)
    .single();

  if (selErr || !entry) {
    return NextResponse.json({ error: selErr?.message || 'not_found' }, { status: 404 });
  }

  const fileName = (entry.file_name || '').trim();
  if (!fileName) {
    return NextResponse.json({ error: 'missing file_name' }, { status: 400 });
  }

  // 1) 画像を加工待ち領域へ **copy**（元実装を踏襲）
  //    既に存在する場合はエラーにしない（元コードと同じ）
  {
    const { error: copyErr } = await admin
      .storage
      .from('artworks')
      .copy(fileName, `pending-processing/${fileName}`);
    if (copyErr && !String(copyErr.message || '').includes('already exists')) {
      return NextResponse.json({ error: `copy_failed: ${copyErr.message}` }, { status: 500 });
    }
  }

  // 2) メタJSONを processing-meta/pending にアップロード（**元の形**）
  {
    const meta = { artistName: entry.artist_name, filename: fileName };
    const body = Buffer.from(JSON.stringify(meta), 'utf-8');
    const { error: upErr } = await admin
      .storage
      .from('processing-meta')
      .upload(`pending/${entry.id}.json`, body, {
        contentType: 'application/json',
        upsert: true,
      });
    if (upErr) {
      return NextResponse.json({ error: `enqueue_failed: ${upErr.message}` }, { status: 500 });
    }
  }

  // 3) DB 承認フラグ（必要最小限のみ。processed列等は触らない）
  {
    const patch = {
      confirmed: true,
      confirmed_at: new Date().toISOString(),
    };
    const { data: updated, error: updErr } = await admin
      .from('entries')
      .update(patch)
      .eq('id', id)
      .select(
        'id, artist_name, email, external_user_id, title, gallery_type, file_name, image_url, confirmed, confirmed_at'
      )
      .single();
    if (updErr || !updated) {
      return NextResponse.json({ error: updErr?.message || 'update_failed' }, { status: 500 });
    }
  }

  // 4) 承認メール（失敗しても承認は維持：ログのみ）
  try {
    if (entry.email && entry.external_user_id) {
      await fetch(`${baseUrl()}/api/send-email/pass`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-meish-admin-token': process.env.ADMIN_API_TOKEN!, // 内部API認証
        },
        body: JSON.stringify({
          to: entry.email,
          name: entry.artist_name,
          externalUserId: entry.external_user_id,
        }),
        cache: 'no-store',
      });
    }
  } catch (e) {
    console.warn('[approve] pass mail failed:', e);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}


