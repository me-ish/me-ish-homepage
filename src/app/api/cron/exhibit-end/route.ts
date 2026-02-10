// src/app/api/cron/exhibit-end/route.ts
// 展示終了時刻に送信するCron API

import { NextRequest, NextResponse } from 'next/server';
import { safeCompare } from '@/lib/auth/timingSafe';
import { getSiteUrl } from '@/lib/constants';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (cronSecret && authHeader && safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    return true;
  }

  const token = req.headers.get('x-meish-admin-token');
  const adminToken = process.env.ADMIN_API_TOKEN;
  if (adminToken && token && safeCompare(token, adminToken)) {
    return true;
  }

  return false;
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

async function handleCron(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60 * 1000);
  const windowEnd = new Date(now.getTime() + 60 * 1000);

  const { data: entries, error: fetchError } = await admin
    .from('entries')
    .select('id, title, user_id, display_end_at')
    .eq('display_ready', true)
    .gte('display_end_at', windowStart.toISOString())
    .lte('display_end_at', windowEnd.toISOString())
    .is('end_notified_at', null);

  if (fetchError) {
    console.error('[exhibit-end] fetch error:', fetchError);
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }

  if (!entries || entries.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No entries to notify' });
  }

  const userIds = [...new Set(entries.map((e: any) => e.user_id).filter(Boolean))] as string[];
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds);
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  const emailMap = new Map<string, string>();
  for (const uid of userIds) {
    const { data: authData } = await admin.auth.admin.getUserById(uid);
    if (authData?.user?.email) emailMap.set(uid, authData.user.email);
  }

  const results: { entryId: number; success: boolean; error?: string }[] = [];

  for (const entry of entries) {
    try {
      if (!entry.user_id) {
        results.push({ entryId: entry.id, success: false, error: 'No user_id' });
        continue;
      }
      const profile = profileMap.get(entry.user_id);
      const artistEmail = emailMap.get(entry.user_id);

      if (!artistEmail) {
        results.push({ entryId: entry.id, success: false, error: 'No email' });
        continue;
      }

      const emailPayload = {
        to: artistEmail,
        name: profile?.display_name || 'アーティスト',
        title: entry.title || '作品',
        displayStartAt: '',
        displayEndAt: entry.display_end_at,
      };

      const emailRes = await fetch(`${getSiteUrl()}/api/send-email/exhibitEnd`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-meish-admin-token': process.env.ADMIN_API_TOKEN || '',
        },
        body: JSON.stringify(emailPayload),
      });

      if (!emailRes.ok) {
        const errText = await emailRes.text().catch(() => '');
        console.error('[exhibit-end] email failed:', entry.id, errText);
        results.push({ entryId: entry.id, success: false, error: errText });
        continue;
      }

      const { error: updateError } = await admin
        .from('entries')
        .update({ end_notified_at: new Date().toISOString() })
        .eq('id', entry.id);

      if (updateError) {
        console.error('[exhibit-end] update error:', updateError);
      }

      results.push({ entryId: entry.id, success: true });
    } catch (err: unknown) {
      console.error('[exhibit-end] error for entry:', entry.id, err);
      const message = err instanceof Error ? err.message : String(err);
      results.push({ entryId: entry.id, success: false, error: message });
    }
  }

  const successCount = results.filter(r => r.success).length;

  return NextResponse.json({
    ok: true,
    total: entries.length,
    sent: successCount,
    results,
  });
}
