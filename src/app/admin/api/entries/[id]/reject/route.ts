// app\admin\api\entries\[id]\reject\route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { EntryReject } from '@/lib/schemas/entry';
import crypto from 'crypto';

function baseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL!;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

function requireAdmin(req: Request) {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) return { ok: false as const, status: 500, error: 'missing_ADMIN_API_TOKEN' };

  const header =
    req.headers.get('x-meish-admin-token') ??
    (req.headers.get('authorization')?.startsWith('Bearer ')
      ? req.headers.get('authorization')!.slice('Bearer '.length)
      : null);

  if (!header) return { ok: false as const, status: 401, error: 'missing_admin_token' };

  const a = Buffer.from(String(header));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return { ok: false as const, status: 403, error: 'invalid_admin_token' };
  const ok = crypto.timingSafeEqual(a, b);
  if (!ok) return { ok: false as const, status: 403, error: 'invalid_admin_token' };

  return { ok: true as const };
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const adminAuth = requireAdmin(req);
  if (!adminAuth.ok) return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status });

  const body = await req.json().catch(() => ({}));
  const parsed = EntryReject.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const { reason = null, notify = true, manageUrl } = parsed.data as { reason?: string | null; notify?: boolean; manageUrl?: string };

  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });

  const admin = supabaseAdmin();

  // 1) 宛先用に取得（メール送る前に必要情報get）
  const { data: before, error: getErr } = await admin
    .from('entries')
    .select('id,email,artist_name,title,reject_email_sent_at')
    .eq('id', id)
    .maybeSingle();

  if (getErr) return NextResponse.json({ error: 'db_get_failed' }, { status: 500 });
  if (!before) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const nowISO = new Date().toISOString();

  // 2) 却下に更新（展示停止の反映は運用に合わせて）
  const { error: updErr } = await admin
    .from('entries')
    .update({
      confirmed: false,
      rejected_at: nowISO,
      reject_reason: reason ?? null,
      display_ready: false,     // 必要なければ外す
      display_end_at: nowISO,   // 必要なければ外す
    })
    .eq('id', id);

  if (updErr) return NextResponse.json({ error: 'db_update_failed' }, { status: 500 });

  // 3) メール送信（未送信なら）
  let mailed = false;
  if (notify && !before.reject_email_sent_at) {
    if (!process.env.ADMIN_API_TOKEN) {
      return NextResponse.json({ error: 'server_misconfig: ADMIN_API_TOKEN' }, { status: 500 });
    }
    const res = await fetch(`${baseUrl()}/api/send-email/reject`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-meish-admin-token': process.env.ADMIN_API_TOKEN,
      },
      body: JSON.stringify({
        to: before.email,
        name: before.artist_name || 'アーティスト様',
        title: before.title || '作品',
        reason,
        manageUrl, // 任意
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // 送信失敗時はフラグを立てない（再送可能にする）
      return NextResponse.json({ error: 'mail_failed', details: err }, { status: 502 });
    }

    await admin
      .from('entries')
      .update({ reject_email_sent_at: nowISO })
      .eq('id', id);

    mailed = true;
  }

  return NextResponse.json({
    ok: true,
    mailed,
    entry: {
      id,
      confirmed: false,
      rejected_at: nowISO,
      reject_reason: reason ?? null,
      display_ready: false,
    },
  });
}
