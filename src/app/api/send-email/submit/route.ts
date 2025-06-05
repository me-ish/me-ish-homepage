// --- /app/api/send-email/submit/route.ts ---
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { generateSubmitEmail } from '@/lib/emailTemplates/submit';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { to, name } = await req.json();
  const { subject, html, text } = generateSubmitEmail(name);

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
