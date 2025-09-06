import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function baseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL!;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // 1) 対象取得
  const { data: entry, error: selErr } = await admin
    .from('entries')
    .select('id, file_name, image_url, email, artist_name, external_user_id, title, gallery_type')
    .eq('id', id)
    .single();

  if (selErr || !entry) {
    return NextResponse.json({ error: selErr?.message || 'not_found' }, { status: 404 });
  }

  // 2) Storage の pending-processing へ移動（失敗しても続行）
  let nextFileName = entry.file_name || null;
  let nextImageUrl = entry.image_url || null;

  if (entry.file_name && !entry.file_name.startsWith('pending-processing/')) {
    const fromPath = entry.file_name;
    const toPath = `pending-processing/${entry.file_name}`;
    try {
      const { error: mvErr } = await admin.storage.from('artworks').move(fromPath, toPath);
      if (!mvErr) {
        nextFileName = toPath;
        const { data: pub } = admin.storage.from('artworks').getPublicUrl(toPath);
        if (pub?.publicUrl) nextImageUrl = pub.publicUrl;
      } else {
        console.warn('[approve] storage move warning:', mvErr);
      }
    } catch (e) {
      console.warn('[approve] storage move exception:', e);
    }
  }

  // 3) 承認フラグ更新（存在する列だけ）
  const patch: Record<string, any> = {
    confirmed: true,
    confirmed_at: new Date().toISOString(),
  };
  if (nextFileName) patch.file_name = nextFileName;
  if (nextImageUrl) patch.image_url = nextImageUrl;

  const { data: updated, error: updErr } = await admin
    .from('entries')
    .update(patch)
    .eq('id', id)
    .select('id, email, artist_name, external_user_id, confirmed, confirmed_at, title, image_url, file_name, gallery_type')
    .single();

  if (updErr || !updated) {
    return NextResponse.json({ error: updErr?.message || 'update_failed' }, { status: 500 });
  }

  // 4) 承認メール（失敗しても承認は維持）
  try {
    const resp = await fetch(`${baseUrl()}/api/send-email/pass`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-meish-admin-token': process.env.ADMIN_API_TOKEN!,
      },
      body: JSON.stringify({
        to: updated.email,
        name: updated.artist_name,
        externalUserId: updated.external_user_id,
      }),
      cache: 'no-store',
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      console.warn('[approve] pass mail not ok:', resp.status, t);
    }
  } catch (e) {
    console.warn('[approve] pass mail failed:', e);
  }

  return NextResponse.json(updated, { status: 200 });
}

