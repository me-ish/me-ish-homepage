// ✅ OKな構成：export されるのは POST のみ
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { generateExhibitEndEmail } from '@/lib/emailTemplates/exhibitEnd';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  const { to, name } = await req.json();
  const { subject, html, text } = generateExhibitEndEmail(name);

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
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

