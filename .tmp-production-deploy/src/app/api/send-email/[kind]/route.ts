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
import { generatePlanPaymentRequestEmail } from '@/lib/emailTemplates/planPaymentRequest';
import { generatePayoutCompleteEmail } from '@/lib/emailTemplates/payoutComplete';
import { generateExhibitEndingSoonEmail } from '@/lib/emailTemplates/exhibitEndingSoon';
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

// reject
const Reject = z.object({
  to: z.string().email(),
  name: z.string().min(1),
  title: z.string().min(1),
  reason: z.string().max(500).optional(),
  manageUrl: z.string().url().optional(),
}).passthrough();

// pass（承認メール）
const Pass = z.object({
  to: z.string().email(),
  name: z.string().min(1),
  externalUserId: z.string().min(1),
  siteUrl: z.string().url().optional(),
  supportEmail: z.string().email().optional(),
  faqUrl: z.string().url().optional(),
  termsUrl: z.string().url().optional(),
}).passthrough();

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

// purchase（Buyer）— amountYen / priceYen どちらでもOKにして正規化
// purchase（Buyer）
// src/app/api/send-email/[kind]/route.ts
const PurchaseBuyer = z.object({
  to: z.string().email(),
  name: z.string().min(1),
  title: z.string().optional(),
  artistName: z.string().optional(),
  orderId: z.string().optional(),
  amountYen: z.number().int().nonnegative().optional(),
  priceYen:  z.number().int().nonnegative().optional(),
  editionNo: z.number().int().optional().nullable(),
  editionTotal: z.number().int().optional().nullable(),
  salesType: z.string().optional(),
  deliveryEtaDays: z.number().int().positive().optional(),
  deliveryAtISO: z.string().optional(),
  manageUrl: z.string().url().optional(),
  downloadUrl: z.string().url().optional(),
  receiptUrl: z.string().url().optional(),
  certificateUrl: z.string().url().optional(),
  coaUrl: z.string().url().optional(),
})
.passthrough()  // ★ 未知キーのサイレント削除を防ぐ（transformより前）
.transform(d => ({ ...d, priceYen: d.priceYen ?? d.amountYen ?? null }));

// purchase（Artist）— amountYen / priceYen どちらでもOKにして正規化
const PurchaseArtist = z.object({
  to: z.string().email(),
  name: z.string().min(1),     // 宛名＝作家名
  title: z.string().optional(),
  amountYen: z.number().int().nonnegative().optional(),
  priceYen:  z.number().int().nonnegative().optional(),
  settlementAt: z.string().optional(), // ISO
}).transform(d => ({ ...d, priceYen: d.priceYen ?? d.amountYen ?? null }));

const PlanPaymentRequest = z.object({
  to: z.string().email(),
  name: z.string().min(1),
  title: z.string().optional(),
  displayPlan: z.string().min(1),
  amountYen: z.number().int().nonnegative(),
  paymentUrl: z.string().url(),
  manageUrl: z.string().url().optional(),
});


// exhibitEndingSoon（展示終了5日前通知）
const ExhibitEndingSoon = z.object({
  to: z.string().email(),
  name: z.string().min(1),
  title: z.string().min(1),
  entryId: z.union([z.number(), z.string()]),
  displayEndAt: z.string(),
  workUrl: z.string().url().optional(),
  renewUrl: z.string().url().optional(),
  manageUrl: z.string().url().optional(),
});

// payoutComplete（振込完了通知）
const PayoutComplete = z.object({
  to: z.string().email(),
  name: z.string().min(1),
  amountYen: z.number().int().nonnegative(),
  periodYm: z.string().optional(),
  itemCount: z.number().int().nonnegative().optional(),
  paidAt: z.string().optional(),
  bankAccountLast4: z.string().max(4).optional(),
  manageUrl: z.string().url().optional(),
  note: z.string().max(500).optional(),
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
  exhibitEndingSoon: { schema: ExhibitEndingSoon, gen: generateExhibitEndingSoonEmail },
  purchaseBuyer: { schema: PurchaseBuyer,  gen: generatePurchaseBuyerEmail },
  purchaseArtist:{ schema: PurchaseArtist, gen: generatePurchaseArtistEmail },
  planPaymentRequest: { schema: PlanPaymentRequest, gen: generatePlanPaymentRequestEmail },
  payoutComplete:{ schema: PayoutComplete, gen: generatePayoutCompleteEmail },
  contact:       { schema: Contact,        gen: generateContactEmail },
} as const;

type Kind = keyof typeof templates;

const resend = new Resend(RESEND_API_KEY);

/* ---------- Handler ---------- */
export async function POST(req: NextRequest, props: { params: Promise<{ kind: string }> }) {
  const params = await props.params;
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

  // メール本文生成
  const { subject, html, text } = (entry.gen as any)(parsed.data);

  // contact は DB にも保存
  if (kind === 'contact') {
    const p = parsed.data as { name: string; email: string; message: string };
    const { error: insErr } = await supabaseAdmin()
      .from('inquiries')
      .insert({
        name: p.name,
        email: p.email,
        message: (p.message ?? '').slice(0, 4000),
        is_read: false,
      });
    if (insErr) console.error('[inquiries] insert error:', insErr);
  }

  // 宛先と Reply-To
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
