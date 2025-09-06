// /app/api/send-email/purchase-nft/route.ts
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { timingSafeEqual } from 'crypto';
import { generatePurchaseNftEmail } from '@/lib/emailTemplates/purchaseNft';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** ───────── Env ───────── */
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

/** ───────── Auth ───────── */
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

/** ───────── Validation ───────── */
const Schema = z.object({
  to: z.string().email(),
  name: z.string().min(1),
  title: z.string().min(1),
  tokenId: z.union([z.string(), z.coerce.number().int()]), // 文字列/数値どちらでも
  claimUrl: z.string().url(),
  network: z.string().optional(),
  faqUrl: z.string().url().optional(),
  termsUrl: z.string().url().optional(),
  supportEmail: z.string().email().optional(),
  expiresAtISO: z.string().datetime().optional(),
  note: z.string().optional(),
});

/** ───────── Resend client ───────── */
const resend = new Resend(RESEND_API_KEY);

/** ───────── Handler ───────── */
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
    const input = parsed.data;

    // メール本文生成（テンプレ側でURLサニタイズ/HTMLエスケープ済み）
    const { subject, html, text } = generatePurchaseNftEmail({
      name: input.name,
      title: input.title,
      tokenId: input.tokenId,
      claimUrl: input.claimUrl,
      network: input.network,
      faqUrl: input.faqUrl,
      termsUrl: input.termsUrl,
      supportEmail: input.supportEmail ?? SUPPORT_EMAIL,
      expiresAtISO: input.expiresAtISO,
      note: input.note,
    });

    const { data, error } = await resend.emails.send({
      from: FROM,
      to: [input.to],
      ...(OP_BCC.length ? { bcc: OP_BCC } : {}),
      subject,
      html,
      text,
      replyTo: SUPPORT_EMAIL,
      headers: {
        'List-Unsubscribe': `<mailto:${SUPPORT_EMAIL}>`,
        'X-Meish-Template': 'purchase-nft',
      },
    });

    if (error) throw error;

    return NextResponse.json({ id: data?.id ?? null, status: 'sent' });
  } catch (e: any) {
    console.error('❌ NFT購入メール送信エラー:', e?.message ?? e);
    return NextResponse.json(
      { error: 'Internal error while sending email' },
      { status: 500 }
    );
  }
}
