// src/app/api/cron/payout-reminder/route.ts
// 振込リマインダー（毎日実行、締め日3日前・振込日5日前に通知）

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { generatePayoutReminderEmail } from '@/lib/emailTemplates/payoutAdminNotice';
import { safeCompare } from '@/lib/auth/timingSafe';
import { getSiteUrl } from '@/lib/constants';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
  const { data } = await admin.from('admin_emails').select('email');
  if (data && data.length > 0) {
    return data.map((r: { email: string }) => r.email);
  }

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
  const daysUntilClose = lastDayOfMonth - currentDay;

  // 振込予定日（25日）までの日数
  const payoutDay = 25;
  let daysUntilPayout: number;
  if (currentDay <= payoutDay) {
    // 今月の25日
    daysUntilPayout = payoutDay - currentDay;
  } else {
    // 来月の25日
    const nextMonth = new Date(currentYear, currentMonth + 1, payoutDay);
    daysUntilPayout = Math.ceil((nextMonth.getTime() - jstNow.getTime()) / (1000 * 60 * 60 * 24));
  }

  // リマインダー送信条件
  // - 締め日3日前
  // - 振込日5日前（既に締め済みの場合）
  const shouldSendCloseReminder = daysUntilClose === 3;
  const shouldSendPayoutReminder = daysUntilPayout === 5 && currentDay > 1; // 月初は除外

  if (!shouldSendCloseReminder && !shouldSendPayoutReminder) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: 'No reminder needed today',
      daysUntilClose,
      daysUntilPayout,
    });
  }

  // 対象期間
  const periodYm = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  // 振込待ち一覧を取得
  const { data: pendingPayouts, error: pendingError } = await (admin as any)
    .from('v_pending_payouts')
    .select('user_id, pending_amount');

  if (pendingError) {
    console.error('[payout-reminder] v_pending_payouts error:', pendingError);
    return NextResponse.json({ error: 'Failed to fetch pending payouts' }, { status: 500 });
  }

  type PendingPayout = { user_id: string; pending_amount: number };
  const payouts = (pendingPayouts ?? []) as PendingPayout[];

  if (payouts.length === 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: 'No pending payouts',
    });
  }

  const totalAmount = payouts.reduce((sum, p) => sum + (p.pending_amount ?? 0), 0);
  const artistCount = payouts.length;

  // 管理者にメール送信
  const adminEmails = await getAdminEmails(admin);

  if (adminEmails.length === 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: 'No admin emails configured',
    });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: 'RESEND_API_KEY not configured',
    });
  }

  const resend = new Resend(resendApiKey);
  const emailContent = generatePayoutReminderEmail({
    periodYm,
    totalAmount,
    artistCount,
    daysUntilClose,
    daysUntilPayout,
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

    console.log(`[payout-reminder] Sent reminder to ${adminEmails.length} admins (close: ${daysUntilClose}d, payout: ${daysUntilPayout}d)`);

    return NextResponse.json({
      ok: true,
      sent: true,
      periodYm,
      totalAmount,
      artistCount,
      daysUntilClose,
      daysUntilPayout,
      notifiedAdmins: adminEmails.length,
      reminderType: shouldSendCloseReminder ? 'close' : 'payout',
    });
  } catch (emailErr: unknown) {
    console.error('[payout-reminder] Email send error:', emailErr);
    const message = emailErr instanceof Error ? emailErr.message : String(emailErr);
    return NextResponse.json({
      error: message || 'Failed to send email',
    }, { status: 500 });
  }
}
