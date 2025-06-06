//--- /app/api/send-email/purchase-nft/route.ts ---
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { generatePurchaseNftEmail } from '@/lib/emailTemplates/purchaseNft';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { to, name, title, tokenId, claimUrl } = await req.json();

  if (!to || !name || !title || !tokenId || !claimUrl) {
    return NextResponse.json({ error: '必要なパラメータが不足しています' }, { status: 400 });
  }

  const { subject, html, text } = generatePurchaseNftEmail(name, title, tokenId, claimUrl);

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
    console.error('❌ NFT購入メール送信エラー:', error);
    return NextResponse.json({ error }, { status: 500 });
  }
}
