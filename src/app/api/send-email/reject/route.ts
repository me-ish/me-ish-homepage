//--- /app/api/send-email/reject/route.ts ---
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { generateRejectEmail } from '@/lib/emailTemplates/reject';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { to, name } = await req.json();
  const { subject, html, text } = generateRejectEmail(name);

  try {
    const data = await resend.emails.send({
      from: 'me-ish Gallery <noreply@me-ish.art>',
      to,
      subject,
      html,
      text,
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
