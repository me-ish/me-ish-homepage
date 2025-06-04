import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const body = await req.json();
  const { to, name } = body;

  try {
    const data = await resend.emails.send({
      from: 'me-ish Gallery <noreply@me-ish.art>', // Resendのドメイン設定済み前提
      to,
      subject: '【me-ish】作品応募を受け付けました',
      html: `
        <p>${name} 様</p>
        <p>この度はme-ishに作品をご応募いただき、誠にありがとうございます。</p>
        <p>内容を確認のうえ、数日以内に審査結果をご連絡いたします。</p>
        <p>---<br/>me-ish運営事務局</p>
      `,
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
