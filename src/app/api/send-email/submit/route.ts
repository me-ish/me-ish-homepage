// --- /app/api/send-email/submit/route.ts ---
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { generateSubmitEmail } from '@/lib/emailTemplates/submit';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM ?? 'me-ish Gallery <noreply@me-ish.art>';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'support@me-ish.art';
const OPS_BCC = process.env.OP_BCC ?? ''; // 例: 'info@me-ish.art'

const Schema = z.object({
  to: z.string().email(),
  name: z.string().min(1),
  manageUrl: z.string().url().optional(),
  faqUrl: z.string().url().optional(),
  termsUrl: z.string().url().optional(),
  supportEmail: z.string().email().optional(),
  slaHours: z.coerce.number().int().positive().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { success, data, error } = Schema.safeParse(body);
    if (!success) {
      return NextResponse.json({ error: 'Invalid payload', details: error.flatten() }, { status: 400 });
    }

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
      ...(OPS_BCC ? { bcc: [OPS_BCC] } : {}),
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
    console.error('submit email error:', e?.message ?? e);
    return NextResponse.json({ error: 'Internal error while sending email' }, { status: 500 });
  }
}
