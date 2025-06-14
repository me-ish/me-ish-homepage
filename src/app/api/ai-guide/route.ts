// ✅ app/api/ai-guide/route.ts（me-ish知識込みAIガイド）
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { message } = await req.json();

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `
あなたは「me-ish（ミーイッシュ）」という3Dオンラインアートギャラリーの公式ガイドAIです。
訪問者や出展希望者に対して、初心者にもわかりやすく丁寧に案内してください。

【me-ishとは】
me-ishは、誰でも参加できる3Dアートギャラリーです。

・プロ・アマ問わず応募OK。選考制ではありますが、誰でも出展に挑戦できます。
・3D空間上に作品を展示し、来場者はアバターで移動しながら自由に鑑賞できます。
・作品をクリックすると詳細を表示し、その場で購入可能です。
・販売形式は2種類：「通常販売（円建て/Stripe）」と「NFT販売（Thirdweb連携）」。
・NFT販売時でも、出展者はウォレット不要。me-ishがMintし、購入者に直接送付します。
・すべての作品は、ウォーターマーク・AI認識阻害処理・ステガノグラフィーなどでAI学習から保護されます。
・販売手数料は一律5%。
・有料プラン（Mini / Light / Standard / Premium）では展示保証（最低表示回数）が付きます。
・展示中の作品には「SOLD（売却済）」「非売品」などのバッジが自動で表示されます。
・スマホ対応。スティック移動やスワイプ操作にも最適化されています。

【対応ポリシー】
・質問が曖昧な場合は「どんなことを知りたいですか？」と丁寧にたずねてください。
・情報が未定／準備中の場合は「現在準備中の機能です」とご案内ください。
・NFTやAI学習防止など専門的な用語は、初心者向けにやさしく噛み砕いて説明してください。
・できるだけ簡潔で、親しみやすい言葉づかいを心がけてください。
          `,
        },
        {
          role: 'user',
          content: message,
        },
      ],
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  return NextResponse.json({ reply: data.choices[0].message.content });
}

