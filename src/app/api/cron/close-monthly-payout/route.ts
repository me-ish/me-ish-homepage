// src/app/api/cron/close-monthly-payout/route.ts
// 月末締め処理（毎月末日に実行）
// - payout_batchesにレコード作成
// - 管理者にメール通知

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { generatePayoutCloseNoticeEmail } from '@/lib/emailTemplates/payoutAdminNotice';
import { safeCompare } from '@/lib/auth/timingSafe';
import { getSiteUrl } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

// 認証チェック
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

// 管理者メールアドレス取得
async function getAdminEmails(admin: ReturnType<typeof supabaseAdmin>): Promise<string[]> {
  // DBから取得
  const { data } = await admin.from('admin_emails').select('email');
  if (data && data.length > 0) {
    return data.map((r: { email: string }) => r.email);
  }

  // フォールバック: 環境変数
  const envEmails = process.env.ADMIN_EMAILS || '';
  return envEmails.split(',').map(s => s.trim()).filter(Boolean);
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

  // 日本時間で計算
  const jstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const currentDay = jstNow.getDate();
  const currentMonth = jstNow.getMonth();
  const currentYear = jstNow.getFullYear();

  // 月末日を計算
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // 強制実行フラグ（手動実行用）
  const forceRun = req.nextUrl.searchParams.get('force') === 'true';

  // 今日が月末日でなければスキップ（強制実行でない場合）
  if (!forceRun && currentDay !== lastDayOfMonth) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: `Not the last day of month (today: ${currentDay}, lastDay: ${lastDayOfMonth})`,
    });
  }

  // 対象期間（現在の年月）
  const periodYm = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  console.log(`[close-monthly-payout] Starting close process for ${periodYm}`);

  // 1. 既に同月のバッチが存在するかチェック
  const { data: existingBatch } = await admin
    .from('payout_batches')
    .select('id, status')
    .eq('period_ym', periodYm)
    .maybeSingle();

  if (existingBatch) {
    console.log(`[close-monthly-payout] Batch already exists for ${periodYm}: ${existingBatch.id} (${existingBatch.status})`);
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: `Batch already exists for ${periodYm}`,
      batchId: existingBatch.id,
      status: existingBatch.status,
    });
  }

  // 2. 振込待ち一覧を取得
  const { data: pendingPayouts, error: pendingError } = await (admin as any)
    .from('v_pending_payouts')
    .select('user_id, display_name, pending_count, pending_amount');

  if (pendingError) {
    console.error('[close-monthly-payout] v_pending_payouts error:', pendingError);
    return NextResponse.json({ error: 'Failed to fetch pending payouts' }, { status: 500 });
  }

  type PendingPayout = {
    user_id: string;
    display_name: string | null;
    pending_count: number;
    pending_amount: number;
  };

  const payouts = (pendingPayouts ?? []) as PendingPayout[];

  if (payouts.length === 0) {
    console.log('[close-monthly-payout] No pending payouts to close');
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: 'No pending payouts',
    });
  }

  // 統計計算
  const totalAmount = payouts.reduce((sum, p) => sum + (p.pending_amount ?? 0), 0);
  const artistCount = payouts.length;
  const saleCount = payouts.reduce((sum, p) => sum + (p.pending_count ?? 0), 0);

  // 3. payout_batchesにレコード作成
  const { data: batch, error: batchError } = await admin
    .from('payout_batches')
    .insert({
      period_ym: periodYm,
      status: 'closed',
      closed_at: now.toISOString(),
      total_amount_yen: totalAmount,
      artist_count: artistCount,
      sale_count: saleCount,
    })
    .select('id')
    .single();

  if (batchError) {
    console.error('[close-monthly-payout] batch insert error:', batchError);
    return NextResponse.json({ error: 'Failed to create batch' }, { status: 500 });
  }

  const batchId = batch.id;
  console.log(`[close-monthly-payout] Created batch ${batchId} for ${periodYm}`);

  // 4. 対象のsalesにclose_batch_idを設定（オプション: バッチに紐付け）
  // 対象ユーザーのsalesを特定してバッチIDを設定
  for (const payout of payouts) {
    const { data: userEntries } = await admin
      .from('entries')
      .select('id')
      .eq('user_id', payout.user_id);

    if (!userEntries || userEntries.length === 0) continue;

    const entryIds = userEntries.map((e: any) => e.id);

    await admin
      .from('sales')
      .update({ close_batch_id: batchId })
      .eq('payout_status', 'pending')
      .not('purchased_at', 'is', null)
      .in('entry_id', entryIds);
  }

  // 5. 管理者にメール通知
  const adminEmails = await getAdminEmails(admin);

  if (adminEmails.length > 0) {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const emailContent = generatePayoutCloseNoticeEmail({
        periodYm,
        totalAmount,
        artistCount,
        saleCount,
        closedAt: now.toISOString(),
        dashboardUrl: `${getSiteUrl()}/admin/payouts`,
      });

      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM || 'me-ish Admin <noreply@me-ish.art>',
          to: adminEmails,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });
        console.log(`[close-monthly-payout] Sent notification to ${adminEmails.length} admins`);
      } catch (emailErr) {
        console.error('[close-monthly-payout] Email send error:', emailErr);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    batchId,
    periodYm,
    totalAmount,
    artistCount,
    saleCount,
    closedAt: now.toISOString(),
    notifiedAdmins: adminEmails.length,
  });
}
