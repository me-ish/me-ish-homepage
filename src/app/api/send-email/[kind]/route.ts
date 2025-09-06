import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

import { generateSubmitEmail } from '@/lib/emailTemplates/submit';
import { generatePassEmail } from '@/lib/emailTemplates/pass';
import { generateRejectEmail } from '@/lib/emailTemplates/reject';
import { generateExhibitStartEmail } from '@/lib/emailTemplates/exhibitStart';
import { generateExhibitEndEmail } from '@/lib/emailTemplates/exhibitEnd';
import { generatePurchaseBuyerEmail } from '@/lib/emailTemplates/purchaseBuyer';
import { generatePurchaseArtistEmail } from '@/lib/emailTemplates/purchaseArtist';
import { generatePurchaseNftEmail } from '@/lib/emailTemplates/purchaseNft';
import { generateContactEmail } from '@/lib/emailTemplates/generateContactEmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ---------- Env ---------- */
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM = process.env.RESEND_FROM ?? 'me-ish Gallery <noreply@me-ish.art>';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'support@me-ish.art';
const OP_BCC = (process.env.OP_BCC || '').split(',').map(s => s.trim()).filter(Boolean);
const ADMIN_API_TOKEN = (process.env.ADMIN_API_TOKEN || '').trim();

/* ---------- Auth (x-meish / Bearer 両対応) ---------- */
function incomingToken(req: NextRequest) {
  const a = req.headers.get('x-meish-admin-token')?.trim();
  const b = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  return a || b || '';
}
function assertAdmin(req: NextRequest): NextResponse | void {
  if (!ADMIN_API_TOKEN) {
    return NextResponse.json({ error: 'server misconfig: ADMIN_API_TOKEN' }, { status: 500 });
  }
  const t = incomingToken(req) || '';
  const A = Buffer.from(ADMIN_API_TOKEN);
  const B = Buffer.from(t);
  if (A.length !== B.length || !timingSafeEqual(A, B)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}

/* ---------- Schemas ---------- */
// submit
const Submit = z.object({
  to: z.string().email(),
  name: z.string().min(1).max(100),
  manageUrl: z.string().url().optional(),
  faqUrl: z.string().url().optional(),
  termsUrl: z.string().url().optional(),
  supportEmail: z.string().email().optional(),
  slaHours: z.coerce.number().int().positive().optional(),
});

// pass / reject
const Pass = z.object({
  to: z.string().email(),
  name: z.string().min(1),
  title: z.string().min(1),
  manageUrl: z.string().url().optional(),
});
const Reject = z.object({
  to: z.string().email(),
  name: z.string().min(1),
  title: z.string().min(1),
  reason: z.string().max(500).optional(),
});

// exhibit start / end
const ExhibitStart = z.object({
  to: z.string().email(),
  name: z.string().min(1),
  title: z.string().min(1),
  displayStartAt: z.string(), // ISO
  displayEndAt: z.string().optional(), // ISO
});
const ExhibitEnd = z.object({
  to: z.string().email(),
  name: z.string().min(1),
  title: z.string().min(1),
  displayStartAt: z.string(), // ISO
  displayEndAt: z.string(),   // ISO
});

// purchase
const PurchaseBuyer = z.object({
  to: z.string().email(),
  name: z.string().min(1),
  title: z.string().min(1),
  orderId: z.string().min(1),
  amountYen: z.number().int().nonnegative(),
  receiptUrl: z.string().url().optional(),
});
const PurchaseArtist = z.object({
  to: z.string().email(),
  name: z.string().min(1),
  title: z.string().min(1),
  amountYen: z.number().int().nonnegative(),
  settlementAt: z.string().optional(), // ISO
});
const PurchaseNft = z.object({
  to: z.string().email(),
  name: z.string().min(1),
  title: z.string().min(1),
  tokenId: z.string().min(1),
  claimUrl: z.string().url(),
});

// contact（運営宛固定／Reply-To は送信者）
const Contact = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  subject: z.string().max(120).optional(),
  message: z.string().min(1).max(4000),
  category: z.enum(['general','bug','howto','entry','purchase','other']).optional(),
  pageUrl: z.string().url().optional(),
  device: z.string().max(120).optional(),
  browser: z.string().max(120).optional(),
  steps: z.string().max(2000).optional(),
});

/* ---------- Template registry ---------- */
const templates = {
  submit:        { schema: Submit,         gen: generateSubmitEmail },
  pass:          { schema: Pass,           gen: generatePassEmail },
  reject:        { schema: Reject,         gen: generateRejectEmail },
  exhibitStart:  { schema: ExhibitStart,   gen: generateExhibitStartEmail },
  exhibitEnd:    { schema: ExhibitEnd,     gen: generateExhibitEndEmail },
  purchaseBuyer: { schema: PurchaseBuyer,  gen: generatePurchaseBuyerEmail },
  purchaseArtist:{ schema: PurchaseArtist, gen: generatePurchaseArtistEmail },
  purchaseNft:   { schema: PurchaseNft,    gen: generatePurchaseNftEmail },
  contact:       { schema: Contact,        gen: generateContactEmail },
} as const;

type Kind = keyof typeof templates;

const resend = new Resend(RESEND_API_KEY);

/* ---------- Handler ---------- */
export async function POST(req: NextRequest, { params }: { params: { kind: string } }) {
  const unauth = assertAdmin(req);
  if (unauth) return unauth;

  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: 'server misconfig: RESEND_API_KEY' }, { status: 500 });
  }

  const kind = params.kind as Kind;
  const entry = templates[kind];
  if (!entry) {
    return NextResponse.json({ error: `unknown template: ${params.kind}` }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = entry.schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // メール内容生成（全テンプレ共通で {subject, html, text} を返す前提）
  // @ts-ignore
  const { subject, html, text } = entry.gen(parsed.data);

  // ★ contact は DB にも保存（管理画面はこのテーブルを参照）
  if (kind === 'contact') {
    const p = parsed.data as { name: string; email: string; message: string };
    const { error: insErr } = await supabaseAdmin
      .from('inquiries')
      .insert({
        name: p.name,
        email: p.email,
        message: (p.message ?? '').slice(0, 4000),
        is_read: false,
      });
    if (insErr) console.error('[inquiries] insert error:', insErr);
  }

  // 宛先と Reply-To を振り分け
  const toAddress = kind === 'contact' ? SUPPORT_EMAIL : (parsed.data as any).to;
  const replyToAddress = kind === 'contact' ? (parsed.data as any).email : SUPPORT_EMAIL;

  const { data: sent, error } = await resend.emails.send({
    from: FROM,
    to: [toAddress],
    ...(OP_BCC.length ? { bcc: OP_BCC } : {}),
    subject,
    html,
    text,
    replyTo: replyToAddress,
    headers: {
      'X-Meish-Template': kind,
      'List-Unsubscribe': `<mailto:${SUPPORT_EMAIL}>`,
    },
  });

  if (error) return NextResponse.json({ error: String(error) }, { status: 500 });
  return NextResponse.json({ id: sent?.id ?? null, status: 'sent' }, { status: 200 });
}
