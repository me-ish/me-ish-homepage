// /app/api/send-email/reject/route.ts
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { timingSafeEqual } from 'crypto';
import { generateRejectEmail } from '@/lib/emailTemplates/reject';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ---------- Env ---------- */
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM = process.env.RESEND_FROM ?? 'me-ish Gallery <noreply@me-ish.art>';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'support@me-ish.art';
/** 確認用 BCC（カンマ区切り対応。未設定なら空配列） */
const OP_BCC = (process.env.OP_BCC || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** 管理トークン（ヘッダ x-meish-admin-token と timing-safe 比較） */
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || '';

/* ---------- Auth ---------- */
function assertAdmin(req: Request): NextResponse | void {
  if (!ADMIN_API_TOKEN) {
    return NextResponse.json(
      { error: 'server misconfig: ADMIN_API_TOKEN' },
      { status: 500 }
    );
  }
  const token = req.headers.get('x-meish-admin-token') || '';
  const a = Buffer.from(ADMIN_API_TOKEN);
  const b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}

/* ---------- Validation ---------- */
const Schema = z.object({
  to: z.string().email(),
  name: z.string().min(1),          // 宛名
  reason: z.string().optional(),    // 理由（任意）
});

/* ---------- Resend client ---------- */
const resend = new Resend(RESEND_API_KEY);

/* ---------- Handler ---------- */
export async function POST(req: Request) {
  // 認可
  const unauth = assertAdmin(req);
  if (unauth) return unauth;

  // Resend 未設定時は 500
  if (!RESEND_API_KEY) {
    return NextResponse.json(
      { error: 'server misconfig: RESEND_API_KEY' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { to, name, reason } = parsed.data;

    // 本文生成（テンプレ側でHTMLエスケープ/URLサニタイズ済み想定）
    const { subject, html, text } = generateRejectEmail(name, reason);

    const { data, error } = await resend.emails.send({
      from: FROM,
      to: [to],
      ...(OP_BCC.length ? { bcc: OP_BCC } : {}),
      subject,
      html,
      text,
      replyTo: SUPPORT_EMAIL,
      headers: {
        'List-Unsubscribe': `<mailto:${SUPPORT_EMAIL}>`,
        'X-Meish-Template': 'reject',
      },
    });

    if (error) throw error;
    return NextResponse.json({ id: data?.id ?? null, status: 'sent' });
  } catch (e: any) {
    console.error('❌ Reject email send error:', e?.message ?? e);
    return NextResponse.json({ error: 'Internal error while sending email' }, { status: 500 });
  }
}
