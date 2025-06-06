//--- /app/api/send-email/exhibit-start/route.ts ---
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { generateExhibitStartEmail } from '@/lib/emailTemplates/exhibitStart';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { to, name } = await req.json();

    if (!to || !name) {
      return NextResponse.json(
        { error: 'name と to は必須です' },
        { status: 400 }
      );
    }

    const { subject, html, text } = generateExhibitStartEmail(name);

    const data = await resend.emails.send({
      from: 'me-ish Gallery <noreply@me-ish.art>',
      to,
      subject,
      html,
      text,
    });

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error('❌ Email送信エラー:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
