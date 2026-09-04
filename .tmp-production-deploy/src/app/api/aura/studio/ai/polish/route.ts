// src/app/api/aura/studio/ai/polish/route.ts
// Studio向け AI文章整えエンドポイント
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { checkCsrf } from '@/lib/auth/csrf';
import { checkRateLimit, getIpFromRequest, rateLimitExceeded } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

type Field = 'bio' | 'tagline' | 'displayTitle';

const SYSTEM_PROMPTS: Record<Field, string> = {
  bio: `あなたはフリーランス・クリエイター向けポートフォリオの文章担当です。
ユーザーが入力した自己紹介文を、仕事依頼につながるよう読みやすく整えてください。

ルール:
- 元の意味・情報は変えない（作り話を加えない）
- 一人称を自然に統一する
- 改行・段落を整える
- 200文字以内を推奨（超える場合は要約可）
- 日本語で出力
- 整えた文章のみを返す（説明・前置き不要）`,

  tagline: `あなたはクリエイター向けポートフォリオのコピーライターです。
ユーザーのキャッチフレーズを、魅力的かつ短く整えてください。

ルール:
- 30文字以内
- 体言止め・短文・エモーショナルなトーン
- 元の意味を活かす
- 日本語で出力
- 整えたキャッチフレーズのみを返す（説明不要）`,

  displayTitle: `あなたはクリエイター向けポートフォリオの編集者です。
ユーザーの肩書き・職種を、端的でわかりやすい表現に整えてください。

ルール:
- 20文字以内
- スラッシュ区切りで複数可
- 日本語または英語で
- 整えた肩書きのみを返す（説明不要）`,
};

export async function POST(req: Request) {
  const csrfErr = checkCsrf(req);
  if (csrfErr) return csrfErr;

  const ip = getIpFromRequest(req);
  const rl = await checkRateLimit(`studio-ai-polish:${ip}`, { limit: 10, windowMs: 5 * 60_000 });
  if (!rl.allowed) return rateLimitExceeded(rl.retryAfterMs);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'ai_unavailable' }, { status: 503 });
  }

  let body: { field?: unknown; text?: unknown } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const field = body.field as Field | undefined;
  const text = typeof body.text === 'string' ? body.text.trim() : '';

  if (!field || !(field in SYSTEM_PROMPTS)) {
    return NextResponse.json({ ok: false, error: 'invalid_field' }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ ok: false, error: 'empty_text' }, { status: 400 });
  }
  if (text.length > 2000) {
    return NextResponse.json({ ok: false, error: 'text_too_long' }, { status: 400 });
  }

  try {
    const client = new OpenAI({ apiKey, timeout: 20_000, maxRetries: 1 });
    const res = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[field] },
        { role: 'user', content: text },
      ],
      max_tokens: 400,
      temperature: 0.7,
    });

    const result = res.choices[0]?.message?.content?.trim() ?? '';
    if (!result) {
      return NextResponse.json({ ok: false, error: 'empty_result' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error('[studio/ai/polish] error', e);
    return NextResponse.json({ ok: false, error: 'ai_failed' }, { status: 500 });
  }
}
