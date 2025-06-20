//--- /app/api/send-email/submit/route.ts ---
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { generateSubmitEmail } from '@/lib/emailTemplates/submit';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const body = await req.json();
  console.log('受信したデータ:', body);

  const { to, name } = body;
  console.log('to:', to, 'name:', name);
  console.log('APIキー:', process.env.RESEND_API_KEY);

  const { subject, html, text } = generateSubmitEmail(name);
  console.log('テンプレ:', subject, html.length, text.length);

  try {
    const data = await resend.emails.send({
      from: 'me-ish Gallery <noreply@me-ish.art>',
      to,
      subject,
      html,
      text,
    });
    console.log('Resend成功:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Resend失敗:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
