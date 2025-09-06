// --- /app/api/send-email/submit/route.ts ---
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { timingSafeEqual } from 'crypto';
import { generateSubmitEmail } from '@/lib/emailTemplates/submit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ---------- Env ---------- */
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM = process.env.RESEND_FROM ?? 'me-ish Gallery <noreply@me-ish.art>';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'support@me-ish.art';
/** 運用確認用の BCC（カンマ区切り対応。未設定なら空配列） */
const OP_BCC = (process.env.OP_BCC || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// /app/api/send-email/submit/route.ts の認証部分だけ差し替え
const ADMIN_API_TOKEN = (process.env.ADMIN_API_TOKEN || '').trim();

function incomingToken(req: Request) {
  const h1 = req.headers.get('x-meish-admin-token')?.trim();
  const h2 = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  return h1 || h2 || '';
}

function assertAdmin(req: Request): NextResponse | void {
  if (!ADMIN_API_TOKEN) {
    return NextResponse.json({ error: 'server misconfig: ADMIN_API_TOKEN' }, { status: 500 });
  }
  const token = incomingToken(req);
  const a = Buffer.from(ADMIN_API_TOKEN);
  const b = Buffer.from(token || '');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}


/* ---------- Validation ---------- */
const Schema = z.object({
  to: z.string().email(),
  name: z.string().min(1).max(100),
  manageUrl: z.string().url().optional(),
  faqUrl: z.string().url().optional(),
  termsUrl: z.string().url().optional(),
  supportEmail: z.string().email().optional(),
  slaHours: z.coerce.number().int().positive().optional(),
});

/* ---------- Resend client ---------- */
const resend = new Resend(RESEND_API_KEY);

/* ---------- Handler ---------- */
export async function POST(req: Request) {
  // 認可（内部API化）
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
    const data = parsed.data;

    // テンプレで件名/本文生成（テンプレ側でURLサニタイズ・HTMLエスケープ済み想定）
    const { subject, html, text } = generateSubmitEmail({
      name: data.name,
      manageUrl: data.manageUrl,
      faqUrl: data.faqUrl,
      termsUrl: data.termsUrl,
      supportEmail: data.supportEmail ?? SUPPORT_EMAIL,
      slaHours: data.slaHours,
    });

    const { data: sent, error: sendErr } = await resend.emails.send({
      from: FROM,
      to: [data.to],
      ...(OP_BCC.length ? { bcc: OP_BCC } : {}),
      subject,
      html,
      text,
      replyTo: SUPPORT_EMAIL,
      headers: {
        'List-Unsubscribe': `<mailto:${SUPPORT_EMAIL}>`,
        'X-Meish-Template': 'submit-simple',
      },
    });
    if (sendErr) throw sendErr;

    return NextResponse.json({ id: sent?.id ?? null, status: 'sent' }, { status: 200 });
  } catch (e: any) {
    console.error('❌ submit email error:', e?.message ?? e);
    return NextResponse.json(
      { error: 'Internal error while sending email' },
      { status: 500 }
    );
  }
}
