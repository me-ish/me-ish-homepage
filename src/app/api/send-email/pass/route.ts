// --- /app/api/send-email/pass/route.ts ---
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { generatePassEmail } from '@/lib/emailTemplates/pass';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM ?? 'me-ish Gallery <noreply@me-ish.art>';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'support@me-ish.art';

const Schema = z.object({
  to: z.string().email(),
  name: z.string().min(1),
  externalUserId: z.string().min(1),
  // オプション（将来拡張したいとき用）
  siteUrl: z.string().url().optional(),
  faqUrl: z.string().url().optional(),
  termsUrl: z.string().url().optional(),
  supportEmail: z.string().email().optional(),
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

    const { subject, html, text } = generatePassEmail({
      name: input.name,
      externalUserId: input.externalUserId,
      siteUrl: input.siteUrl,
      faqUrl: input.faqUrl,
      termsUrl: input.termsUrl,
      supportEmail: input.supportEmail ?? SUPPORT_EMAIL,
    });

    const { data, error } = await resend.emails.send({
      from: FROM,
      to: [input.to],
      subject,
      html,
      text,
      replyTo: SUPPORT_EMAIL,
      headers: {
        'List-Unsubscribe': `<mailto:${SUPPORT_EMAIL}>`,
        'X-Meish-Template': 'pass',
      },
      // tags: [{ name: 'category', value: 'pass' }], // SDKが古くて型NGならコメントアウト
    });

    if (error) throw error;
    return NextResponse.json({ id: data?.id ?? null, status: 'sent' });
  } catch (e: any) {
    console.error('pass email error:', e?.message ?? e);
    return NextResponse.json({ error: 'Internal error while sending email' }, { status: 500 });
  }
}
