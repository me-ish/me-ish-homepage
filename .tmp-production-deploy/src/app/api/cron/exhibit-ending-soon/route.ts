// src/app/api/cron/exhibit-ending-soon/route.ts
// 展示終了5日前の通知を送信するCron API
// Vercel Cron や外部スケジューラから毎日1回呼び出す想定

import { NextRequest, NextResponse } from 'next/server';
import { safeCompare } from '@/lib/auth/timingSafe';
import { getSiteUrl } from '@/lib/constants';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 最大60秒

// 認証チェック（Cron secretまたはADMIN_API_TOKEN）
function isAuthorized(req: NextRequest): boolean {
  // Vercel Cron の場合
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (cronSecret && authHeader && safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    return true;
  }

  // ADMIN_API_TOKEN の場合
  const token = req.headers.get('x-meish-admin-token');
  const adminToken = process.env.ADMIN_API_TOKEN;
  if (adminToken && token && safeCompare(token, adminToken)) {
    return true;
  }

  return false;
}

export async function GET(req: NextRequest) {
  // POST でも呼べるようにする（Vercel Cronは GET）
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

  // 5日後の日付範囲を計算（その日の0:00〜23:59:59）
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + 5);
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);


  // 5日後に終了する作品を取得
  // - display_ready = true（展示中）
  // - display_end_at が5日後
  // - ending_soon_notified_at が null（未通知）
  const { data: entries, error: fetchError } = await admin
    .from('entries')
    .select('id, title, user_id, display_end_at')
    .eq('display_ready', true)
    .gte('display_end_at', dayStart.toISOString())
    .lte('display_end_at', dayEnd.toISOString())
    .is('ending_soon_notified_at', null);

  if (fetchError) {
    console.error('[exhibit-ending-soon] fetch error:', fetchError);
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }

  if (!entries || entries.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No entries to notify' });
  }


  // ✅ プロフィールをバッチ取得（N+1 防止）
  const userIds = [...new Set(entries.map((e: any) => e.user_id).filter(Boolean))] as string[];
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds);
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  // Auth ユーザーのメールもバッチ取得（listUsers で一括、max 1000）
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

      // メール送信
      const emailPayload = {
        to: artistEmail,
        name: profile?.display_name || 'アーティスト',
        title: entry.title || '作品',
        entryId: entry.id,
        displayEndAt: entry.display_end_at,
        workUrl: `${getSiteUrl()}/works/${entry.id}`,
        manageUrl: `${getSiteUrl()}/mypage`,
      };

      const emailRes = await fetch(`${getSiteUrl()}/api/send-email/exhibitEndingSoon`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-meish-admin-token': process.env.ADMIN_API_TOKEN || '',
        },
        body: JSON.stringify(emailPayload),
      });

      if (!emailRes.ok) {
        const errText = await emailRes.text().catch(() => '');
        console.error('[exhibit-ending-soon] email failed:', entry.id, errText);
        results.push({ entryId: entry.id, success: false, error: errText });
        continue;
      }

      // 通知済みフラグを更新
      const { error: updateError } = await admin
        .from('entries')
        .update({ ending_soon_notified_at: new Date().toISOString() })
        .eq('id', entry.id);

      if (updateError) {
        // メールは送信済みなので成功扱い
      }

      results.push({ entryId: entry.id, success: true });
    } catch (err: unknown) {
      console.error('[exhibit-ending-soon] error for entry:', entry.id, err);
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
