// src/app/admin/api/entries/[id]/approve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import crypto from "crypto";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function baseUrl() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL!;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

/** ADMIN_API_TOKEN の検証（fail closed） */
function requireAdmin(req: NextRequest) {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) return { ok: false as const, status: 500, error: "missing_ADMIN_API_TOKEN" };

  // 互換: 以前提案した Authorization: Bearer も受けるならここで拾う
  const header =
    req.headers.get("x-meish-admin-token") ??
    (req.headers.get("authorization")?.startsWith("Bearer ")
      ? req.headers.get("authorization")!.slice("Bearer ".length)
      : null);

  if (!header) return { ok: false as const, status: 401, error: "missing_admin_token" };

  // timing-safe compare
  const a = Buffer.from(String(header));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return { ok: false as const, status: 403, error: "invalid_admin_token" };
  const ok = crypto.timingSafeEqual(a, b);
  if (!ok) return { ok: false as const, status: 403, error: "invalid_admin_token" };

  return { ok: true as const };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // ✅ まず認証
  const adminAuth = requireAdmin(req);
  if (!adminAuth.ok) {
    return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status });
  }

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

  // 1) 画像を加工待ち領域へ copy
  {
    const { error: copyErr } = await admin
      .storage
      .from('artworks')
      .copy(fileName, `pending-processing/${fileName}`);
    if (copyErr && !String(copyErr.message || '').includes('already exists')) {
      return NextResponse.json({ error: `copy_failed: ${copyErr.message}` }, { status: 500 });
    }
  }

  // 2) メタJSONを processing-meta/pending にアップロード
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

  // 3) DB 承認フラグ
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

  // 4) 承認メール（失敗しても承認は維持）
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
