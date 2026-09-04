//api\send-email\send-contact\route.ts
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkRateLimit, getIpFromRequest, rateLimitExceeded } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ---------- Env ---------- */
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM = process.env.RESEND_FROM ?? 'me-ish Gallery <noreply@me-ish.art>';
const TO = process.env.CONTACT_TO ?? 'info@me-ish.art';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'support@me-ish.art';
/** 運用BCC（カンマ区切り）。未設定なら空配列 */
const OP_BCC = (process.env.OP_BCC || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Cloudflare Turnstile 秘密鍵（任意） */
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || '';

/* ---------- Validation ---------- */
const Schema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  message: z.string().trim().min(1).max(4000),
  /** 蜜壺（hidden）。ボットは埋めがち。ユーザーUIからは送らない想定 */
  website: z.string().optional(), // honeypot
  /** Turnstile のトークン（任意） */
  turnstileToken: z.string().optional(),
});

/* ---------- Utils ---------- */
function sanitizeSubjectFragment(s: string) {
  // ざっくりCR/LF除去（ヘッダインジェクション予防）
  return s.replace(/[\r\n]+/g, ' ').slice(0, 120);
}

async function verifyTurnstile(token?: string, ip?: string) {
  if (!TURNSTILE_SECRET) return true; // 無効時はスキップ
  if (!token) return false;
  try {
    const form = new URLSearchParams();
    form.append('secret', TURNSTILE_SECRET);
    form.append('response', token);
    if (ip) form.append('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const json = (await res.json()) as { success?: boolean };
    return !!json.success;
  } catch {
    // 検証失敗時は通さない
    return false;
  }
}

/* ---------- Resend client ---------- */
const resend = new Resend(RESEND_API_KEY);

/* ---------- Handler ---------- */
export async function POST(req: Request) {
  const ip = getIpFromRequest(req);
  const rl = await checkRateLimit(`contact:${ip}`, { limit: 3, windowMs: 600_000 });
  if (!rl.allowed) return rateLimitExceeded(rl.retryAfterMs);

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
    const { name, email, message, website, turnstileToken } = parsed.data;

    // 蜜壺：値が入っていたら成功風レスポンスで終了（保存・送信しない）
    if (website && website.trim() !== '') {
      return NextResponse.json({ success: true, mailed: false, spam: true });
    }

    // Turnstile（任意）：設定があれば検証
    const humanOk = await verifyTurnstile(turnstileToken, ip);
    if (!humanOk) {
      return NextResponse.json({ error: 'bot verification failed' }, { status: 400 });
    }

    // 1) DB保存（先に確定させる）
    //   inquiriesテーブルが name/email/message を受け取る想定
    const admin = supabaseAdmin();
    const { error: dbErr } = await admin
      .from('inquiries')
      .insert([{ name, email, message }]);

    if (dbErr) {
      console.error('[contact] DB insert failed:', dbErr);
      return NextResponse.json({ error: 'DB insert failed' }, { status: 500 });
    }

    // 2) 通知メール（ベストエフォート）
    let mailed = false;
    try {
      const subject = `お問い合わせ from ${sanitizeSubjectFragment(name)}`;
      const text = `名前: ${name}\nメール: ${email}\nIP: ${ip ?? '-'}\n\n${message}`;
      const html = `
        <div style="font:14px/1.7 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', Meiryo, Arial, sans-serif;">
          <p><b>名前:</b> ${escapeHtml(name)}<br/>
          <b>メール:</b> ${escapeHtml(email)}<br/>
          <b>IP:</b> ${escapeHtml(ip ?? '-')}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0"/>
          <pre style="white-space:pre-wrap;font:inherit;margin:0">${escapeHtml(message)}</pre>
        </div>
      `;

      const { error: mailErr } = await resend.emails.send({
        from: FROM,
        to: [TO],
        ...(OP_BCC.length ? { bcc: OP_BCC } : {}),
        subject,
        text,
        html,
        replyTo: email || SUPPORT_EMAIL, // 直接返信しやすく
        headers: {
          'List-Unsubscribe': `<mailto:${SUPPORT_EMAIL}>`,
          'X-Meish-Template': 'contact',
        },
      });
      if (mailErr) throw mailErr;
      mailed = true;
    } catch (e) {
      // mailed=false のまま継続
    }

    return NextResponse.json({ success: true, mailed });
  } catch (err) {
    console.error('[contact] Unhandled Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ---------- tiny helpers ---------- */
function escapeHtml(s: string) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
