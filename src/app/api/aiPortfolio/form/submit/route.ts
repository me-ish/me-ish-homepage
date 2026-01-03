// src/app/api/aiPortfolio/form/submit/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

import {
  FormInputSchema,
  type FormInput,
} from "@/lib/aiPortfolio/aiPortfolio.schema";

import { generatePortfolioFromForm } from "@/lib/aiPortfolio/aiPortfolio.generate";
import { supabaseAdmin } from "@/lib/aiPortfolio/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * この submit API は2形式を受ける：
 * A) FormInput そのまま（旧仕様 / 互換）
 * B) { requestId: string, ...FormInput, avatarUrl? }（draft連携 / 新仕様）
 */
function extractRequestIdAndPayload(json: any): {
  requestId: string | null;
  payload: any; // FormInputSchema で validate される
  avatarUrl?: string;
} {
  if (!json || typeof json !== "object") {
    return { requestId: null, payload: json };
  }

  const maybeId =
    typeof json.requestId === "string" && json.requestId.trim()
      ? json.requestId.trim()
      : null;

  const avatarUrl =
    typeof json.avatarUrl === "string" && json.avatarUrl.trim()
      ? json.avatarUrl.trim()
      : undefined;

  if (!maybeId) {
    return { requestId: null, payload: json, avatarUrl };
  }

  // requestId / avatarUrl を除いたものを payload として扱う
  const { requestId, avatarUrl: _a, ...rest } = json;
  return { requestId: maybeId, payload: rest, avatarUrl };
}

/* =========================================================
 * SNS/URL normalize helpers
 * - 入力が「@handle」「handle」「example.com」「https://...」など
 *   バラバラでも、最終的に href として成立する形に寄せる
 * ========================================================= */
function normalizeMaybeUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  const v = String(raw).trim();
  if (!v) return undefined;

  // すでにURL
  if (/^https?:\/\//i.test(v)) return v;

  // mailto はそのまま
  if (/^mailto:/i.test(v)) return v;

  // 先頭の @ を除去
  const noAt = v.replace(/^@+/, "").trim();
  if (!noAt) return undefined;

  // ドメインっぽい（例: example.com/path）なら https:// を付与
  // ただし "sample.illust" はハンドルの可能性もあるが、
  // URL化するなら https:// を付けないと href として成立しない
  if (noAt.includes(".") && !noAt.includes(" ")) {
    return `https://${noAt}`;
  }

  // それ以外は「ID」として返す（platform側でURL化する）
  return noAt;
}

function buildPlatformUrl(
  platform: "x" | "instagram" | "pixiv" | "skeb" | "booth",
  raw?: string
): string | undefined {
  const v = normalizeMaybeUrl(raw);
  if (!v) return undefined;

  // すでにURLならそれを優先
  if (/^https?:\/\//i.test(v) || /^mailto:/i.test(v)) return v;

  // IDの場合のみ platform URL を組む
  switch (platform) {
    case "x":
      return `https://x.com/${v}`;
    case "instagram":
      return `https://instagram.com/${v}`;
    case "pixiv":
      // pixivはユーザーURLが複数パターンあるので最小限で対応
      // ID/ユーザー名どちらでもとりあえず users 形式へ寄せる
      return `https://www.pixiv.net/users/${v}`;
    case "skeb":
      return `https://skeb.jp/@${v}`;
    case "booth":
      // booth はショップURLが多様なので、IDなら検索に寄せるのもありだが、
      // ここでは booth.pm のトップに寄せず「URLでないなら https:// を付けた形」を採用しない。
      // したがって ID の場合は undefined にし、ユーザーにURL入力を促すのが安全。
      // ただし現状のUXを崩したくないなら、下の行を有効化してもよい。
      // return `https://${v}.booth.pm`;
      return undefined;
  }
}

function buildWebsiteUrl(raw?: string): string | undefined {
  const v = normalizeMaybeUrl(raw);
  if (!v) return undefined;

  // ID（URLでない）なら、ドメイン化できないので捨てる
  if (!/^https?:\/\//i.test(v) && !/^mailto:/i.test(v)) return undefined;

  return v;
}

// ------------------------------------------------------------
// GET（OpenAI 接続テスト用 / 既存仕様そのまま）
// ------------------------------------------------------------
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("test_openai") !== "1") {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "OPENAI_API_KEY is not set" },
      { status: 500 }
    );
  }

  const client = new OpenAI({ apiKey, timeout: 10_000, maxRetries: 0 });

  try {
    const res = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "user", content: "返事は一言で「OK」とだけ返してください。" },
      ],
    });

    return NextResponse.json(
      { ok: true, result: res.choices[0]?.message?.content ?? "" },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[aiPortfolio/form/submit][GET test_openai] error", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}

// ------------------------------------------------------------
// POST
// ------------------------------------------------------------
export async function POST(req: Request) {
  const supabase = supabaseAdmin();
  const json = await req.json().catch(() => null);

  // 1) requestId/payload/avatarUrl を分離
  const { requestId, payload, avatarUrl } = extractRequestIdAndPayload(json);

  // 2) ✅ Zod parse 前に SNS を退避（schema外キーは parse で落ちるため）
  const raw = payload && typeof payload === "object" ? (payload as any) : {};

  // social オブジェクト（フォームが social:{...} で送ってくる場合）
  const rawSocial =
    raw.social && typeof raw.social === "object" ? raw.social : undefined;

  // トップレベル or social配下 どちらでも拾える getter
  const pick = (key: string): string | undefined => {
    const v1 = typeof raw[key] === "string" ? raw[key].trim() : "";
    const v2 =
      rawSocial && typeof rawSocial[key] === "string"
        ? String(rawSocial[key]).trim()
        : "";
    return v1 ? v1 : v2 ? v2 : undefined;
  };

  // --- 生値（ID/URL混在）を拾う ---
  const rawX =
    pick("xUrl") ??
    pick("twitterUrl") ??
    pick("twitter") ??
    pick("x") ??
    pick("twitterId");

  const rawIg =
    pick("instagramUrl") ??
    pick("instagram") ??
    pick("ig") ??
    pick("insta");

  const rawPixiv = pick("pixivUrl") ?? pick("pixiv");
  const rawSkeb = pick("skebUrl") ?? pick("skeb");
  const rawBooth = pick("boothUrl") ?? pick("booth");

  const rawWebsite =
    pick("websiteUrl") ??
    pick("siteUrl") ??
    pick("website") ??
    pick("site");

  const rawPortfolio = pick("portfolioUrl") ?? pick("portfolio");

  // --- 正規化（hrefとして成立する形へ） ---
  const normalizedSocial = {
    xUrl: buildPlatformUrl("x", rawX),
    instagramUrl: buildPlatformUrl("instagram", rawIg),
    pixivUrl: buildPlatformUrl("pixiv", rawPixiv),
    skebUrl: buildPlatformUrl("skeb", rawSkeb),
    boothUrl:
      // boothはID推測が危険なので URLっぽい時だけ採用
      buildWebsiteUrl(rawBooth),
    websiteUrl: buildWebsiteUrl(rawWebsite),
    portfolioUrl: buildWebsiteUrl(rawPortfolio),
  };

  // links 配列をフォームが送っている場合も救済（schema外なら落ちるため）
  const rescuedLinksRaw = Array.isArray(raw.links) ? raw.links : undefined;
  const rescuedSocialLinksRaw = Array.isArray(raw.socialLinks)
    ? raw.socialLinks
    : undefined;
  const rescuedSnsArrayRaw = Array.isArray(raw.sns) ? raw.sns : undefined;

  // 3) Zod parse
  const parsed = FormInputSchema.safeParse(payload);
  if (!parsed.success) {
    console.error(
      "aiPortfolio: invalid form payload",
      parsed.error.issues,
      payload
    );
    return NextResponse.json(
      { ok: false, error: "invalid", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // 4) ✅ parse後に復元して formInput を作る（DB保存 & generate入力）
  //    - socialオブジェクトも “正規化済み” を保存
  const rebuiltSocialObj = rawSocial
    ? {
        ...rawSocial,
        // フォームが twitter/instagram/website で持っているケースを吸収
        twitter:
          (rawSocial as any)?.twitter ??
          (rawSocial as any)?.x ??
          (rawSocial as any)?.twitterId ??
          undefined,
        instagram:
          (rawSocial as any)?.instagram ??
          (rawSocial as any)?.ig ??
          (rawSocial as any)?.insta ??
          undefined,
        website:
          (rawSocial as any)?.website ??
          (rawSocial as any)?.site ??
          (rawSocial as any)?.url ??
          undefined,
      }
    : undefined;

  // social の中身も “URLとして成立する形” を別名で保持したい場合があるので、ここで上書きもしておく
  // （generate側が social.twitter 等を見ているなら、正規化したURLを入れる）
  const normalizedSocialObj = rebuiltSocialObj
    ? {
        ...rebuiltSocialObj,
        twitter: normalizedSocial.xUrl ?? (rebuiltSocialObj as any).twitter,
        instagram:
          normalizedSocial.instagramUrl ?? (rebuiltSocialObj as any).instagram,
        website: normalizedSocial.websiteUrl ?? (rebuiltSocialObj as any).website,
      }
    : undefined;

  const formInput: FormInput & {
    avatarUrl?: string;
    social?: any;
    links?: any[];
    socialLinks?: any[];
    sns?: any[];
    // SNS単体キーもトップレベルに戻す（generate側の互換のため）
    xUrl?: string;
    instagramUrl?: string;
    pixivUrl?: string;
    skebUrl?: string;
    boothUrl?: string;
    websiteUrl?: string;
    portfolioUrl?: string;
  } = {
    ...parsed.data,
    avatarUrl,
    social: normalizedSocialObj, // ✅ 正規化済みの social を保持
    ...normalizedSocial, // ✅ トップレベルキーも正規化済みに統一
    ...(rescuedLinksRaw ? { links: rescuedLinksRaw } : {}),
    ...(rescuedSocialLinksRaw ? { socialLinks: rescuedSocialLinksRaw } : {}),
    ...(rescuedSnsArrayRaw ? { sns: rescuedSnsArrayRaw } : {}),
  };

  // デバッグ（必要なら）
  console.log("### SUBMIT normalizedSocial", normalizedSocial);
  console.log("### SUBMIT social(normalized)", normalizedSocialObj);

  // ------------------------------------------------------------
  // 1) id を確定（draft 連携 or 新規）
  //    ※ status は draft / generated / error で統一
  // ------------------------------------------------------------
  let id: string | null = null;

  if (requestId) {
    const { data: found, error: selErr } = await supabase
      .from("aura_requests")
      .select("id")
      .eq("id", requestId)
      .maybeSingle();

    if (selErr) {
      console.error("[aiPortfolio/form/submit] select draft failed", selErr);
      return NextResponse.json(
        { ok: false, error: "select_failed" },
        { status: 500 }
      );
    }

    if (found?.id) {
      const { error: updDraftErr } = await supabase
        .from("aura_requests")
        .update({
          status: "draft",
          error: null,
          payload: formInput, // avatarUrl / social 正規化含む
          design: null,
          content: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (updDraftErr) {
        console.error(
          "[aiPortfolio/form/submit] update draft failed",
          updDraftErr
        );
        return NextResponse.json(
          { ok: false, error: "update_draft_failed" },
          { status: 500 }
        );
      }

      id = requestId;
    } else {
      console.warn(
        "[aiPortfolio/form/submit] requestId not found. fallback insert.",
        requestId
      );
    }
  }

  if (!id) {
    const { data: created, error: insErr } = await supabase
      .from("aura_requests")
      .insert({
        status: "draft",
        error: null,
        payload: formInput, // avatarUrl / social 正規化含む
        design: null,
        content: null,
        slug: null,
        // email カラムがあるなら入る。無いならここは消してOK（列不一致で落ちるため）
        email: (formInput as any)?.email ?? null,
      })
      .select("id")
      .single();

    if (insErr || !created?.id) {
      console.error("[aiPortfolio/form/submit] insert failed", insErr);
      return NextResponse.json(
        { ok: false, error: "insert_failed" },
        { status: 500 }
      );
    }

    id = String(created.id);
  }

  // ------------------------------------------------------------
  // 2) 生成 → 3) generated 保存
  // ------------------------------------------------------------
  try {
    const { design, content } = await generatePortfolioFromForm(formInput);

    const { error: updErr } = await supabase
      .from("aura_requests")
      .update({
        status: "generated",
        error: null,
        design,
        content,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updErr) throw updErr;

    return NextResponse.json({ ok: true, id, status: "generated" });
  } catch (e: any) {
    const message = e?.message ?? String(e);
    console.error("[aiPortfolio/form/submit] generate error", e);

    await supabase
      .from("aura_requests")
      .update({
        status: "error",
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    // 重要：失敗でも id は返す
    return NextResponse.json(
      { ok: false, id, status: "error", error: "generate_failed", message },
      { status: 200 }
    );
  }
}
