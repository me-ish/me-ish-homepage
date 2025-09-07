// --- /app/api/send-email/pass/route.ts ---
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { generatePassEmail } from '@/lib/emailTemplates/pass';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { to, name, externalUserId } = await req.json();

  if (!to || !name || !externalUserId) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const { subject, html, text } = generatePassEmail(name, externalUserId);

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
    console.error('メール送信エラー:', error);
    return NextResponse.json({ error }, { status: 500 });
  }
}
