// /app/api/send-email/reject/route.ts
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { generateRejectEmail } from '@/lib/emailTemplates/reject';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { to, name, reason } = await req.json();

  const { subject, html, text } = generateRejectEmail(name, reason);

  try {
    const { data, error } = await resend.emails.send({
      from: 'me-ish Gallery <noreply@me-ish.art>',
      to,
      subject,
      html,
      text,
      replyTo: 'support@me-ish.art',
      headers: { 'X-Meish-Template': 'reject' },
    });
    if (error) throw error;
    return NextResponse.json({ id: data?.id ?? null, status: 'sent' });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

