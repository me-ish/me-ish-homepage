// src/app/api/aura/form/ai-suggest/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { checkCsrf } from "@/lib/auth/csrf";
import { checkRateLimit, getIpFromRequest, rateLimitExceeded } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const csrfErr = checkCsrf(req);
  if (csrfErr) return csrfErr;

  const ip = getIpFromRequest(req);
  const rl = await checkRateLimit(`aura-ai-suggest:${ip}`, { limit: 10, windowMs: 600_000 });
  if (!rl.allowed) return rateLimitExceeded(rl.retryAfterMs);

  const json = await req.json().catch(() => null);
  if (!json || typeof json !== "object") {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const field = json.field as string;
  if (field !== "tagline" && field !== "bio") {
    return NextResponse.json({ ok: false, error: "invalid_field" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "openai_not_configured" }, { status: 500 });
  }

  const name = String(json.name ?? "").trim();
  const title = String(json.title ?? "").trim();
  const bio = String(json.bio ?? "").trim();
  const worldviewBase = String(json.worldviewBase ?? "minimal").trim();
  const tone = json.tone === "フレンドリー" ? "フレンドリー" : "ですます";
  const specialties: string[] = Array.isArray(json.specialties) ? json.specialties.map(String) : [];
  const vibes: string[] = Array.isArray(json.vibes) ? json.vibes.map(String) : [];

  const client = new OpenAI({ apiKey, timeout: 15_000, maxRetries: 1 });

  try {
    let prompt = "";

    if (field === "tagline") {
      prompt =
        `以下のクリエイターのキャッチコピー（tagline）を1行で生成してください。\n` +
        `名前: ${name || "（未入力）"}\n` +
        `肩書き: ${title || "（未入力）"}\n` +
        `自己紹介: ${bio || "（未入力）"}\n` +
        `世界観: ${worldviewBase}\n` +
        `トーン: ${tone}\n` +
        `得意なこと: ${specialties.length > 0 ? specialties.join("、") : "（未選択）"}\n` +
        `雰囲気・スタイル: ${vibes.length > 0 ? vibes.join("、") : "（未選択）"}\n\n` +
        `要件:\n` +
        `- 30文字以内\n` +
        `- 日本語\n` +
        `- 「何が得意か」「どんな雰囲気か」が一目で伝わる\n` +
        `- キャッチーで印象的\n` +
        `- 文末に句読点不要\n\n` +
        `キャッチコピーのみを返してください。説明不要。`;
    } else {
      prompt =
        `以下のクリエイターの自己紹介文（bio）を生成してください。\n` +
        `名前: ${name || "（未入力）"}\n` +
        `肩書き: ${title || "（未入力）"}\n` +
        `世界観: ${worldviewBase}\n` +
        `トーン: ${tone}\n\n` +
        `要件:\n` +
        `- 100〜200文字程度\n` +
        `- 日本語\n` +
        `- ${tone === "フレンドリー" ? "やわらかく親しみやすいトーン" : "ですます調・落ち着いたトーン"}\n` +
        `- 実績、得意分野、スタンスを自然に含める\n` +
        `- ポートフォリオのAboutセクションとして自然な文章\n\n` +
        `自己紹介文のみを返してください。説明不要。`;
    }

    const res = await client.chat.completions.create({
      model: process.env.AURA_MODEL ?? "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.8,
    });

    const text = res.choices[0]?.message?.content?.trim() ?? "";
    if (!text) {
      return NextResponse.json({ ok: false, error: "empty_response" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, text });
  } catch (e) {
    console.error("[aura/form/ai-suggest] error", e);
    return NextResponse.json({ ok: false, error: "generation_failed" }, { status: 500 });
  }
}
