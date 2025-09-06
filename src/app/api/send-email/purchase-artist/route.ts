// --- /app/api/send-email/purchase-artist/route.ts ---
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { generatePurchaseArtistEmail } from '@/lib/emailTemplates/purchaseArtist';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM ?? 'me-ish Gallery <noreply@me-ish.art>';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'support@me-ish.art';
const OPS_BCC = process.env.OP_BCC ?? ''; // 任意

const Schema = z.object({
  to: z.string().email(),
  name: z.string().min(1),

  // 任意の明細（文字列でも来やすいのでcoerce）
  title: z.string().optional(),
  priceYen: z.coerce.number().int().nonnegative().optional(),
  editionNo: z.coerce.number().int().positive().optional(),
  editionTotal: z.coerce.number().int().positive().optional(),
  orderId: z.string().optional(),
  salesType: z.string().optional(),

  manageUrl: z.string().url().optional(),
  faqUrl: z.string().url().optional(),
  termsUrl: z.string().url().optional(),
  supportEmail: z.string().email().optional(),
  payoutEtaDays: z.coerce.number().int().positive().optional(),
  payoutAtISO: z.string().datetime().optional(),
  siteUrl: z.string().url().optional(),
  note: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const input = parsed.data;

    const { subject, html, text } = generatePurchaseArtistEmail({
      name: input.name,
      title: input.title,
      priceYen: input.priceYen,
      editionNo: input.editionNo,
      editionTotal: input.editionTotal,
      orderId: input.orderId,
      salesType: input.salesType,
      manageUrl: input.manageUrl,
      faqUrl: input.faqUrl,
      termsUrl: input.termsUrl,
      supportEmail: input.supportEmail ?? SUPPORT_EMAIL,
      payoutEtaDays: input.payoutEtaDays,
      payoutAtISO: input.payoutAtISO,
      siteUrl: input.siteUrl,
      note: input.note,
    });

    const { data, error } = await resend.emails.send({
      from: FROM,
      to: [input.to],
      ...(OPS_BCC ? { bcc: [OPS_BCC] } : {}),
      subject,
      html,
      text,
      replyTo: SUPPORT_EMAIL,
      headers: {
        'List-Unsubscribe': `<mailto:${SUPPORT_EMAIL}>`,
        'X-Meish-Template': 'purchase-artist',
      },
    });

    if (error) throw error;
    return NextResponse.json({ id: data?.id ?? null, status: 'sent' });
  } catch (e: any) {
    console.error('purchase-artist email error:', e?.message ?? e);
    return NextResponse.json({ error: 'Internal error while sending email' }, { status: 500 });
  }
}
