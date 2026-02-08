// src/app/api/aura/form/submit/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { randomUUID } from "crypto";

import {
  FormInputSchema,
  type FormInput,
} from "@/lib/aura/aura.schema";

import { generatePortfolioFromForm } from "@/lib/aura/aura.generate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Json } from "@/types/supabase";
import {
  requireAuraRequestAccess,
  buildAuraSessionCookie,
} from "@/lib/aura/requireAuraAccess";

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
 * ========================================================= */
function normalizeMaybeUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  const v = String(raw).trim();
  if (!v) return undefined;

  if (/^https?:\/\//i.test(v)) return v;
  if (/^mailto:/i.test(v)) return v;

  const noAt = v.replace(/^@+/, "").trim();
  if (!noAt) return undefined;

  if (noAt.includes(".") && !noAt.includes(" ")) {
    return `https://${noAt}`;
  }

  return noAt;
}

function buildPlatformUrl(
  platform: "x" | "instagram" | "pixiv" | "skeb" | "booth",
  raw?: string
): string | undefined {
  const v = normalizeMaybeUrl(raw);
  if (!v) return undefined;

  if (/^https?:\/\//i.test(v) || /^mailto:/i.test(v)) return v;

  switch (platform) {
    case "x":
      return `https://x.com/${v}`;
    case "instagram":
      return `https://instagram.com/${v}`;
    case "pixiv":
      return `https://www.pixiv.net/users/${v}`;
    case "skeb":
      return `https://skeb.jp/@${v}`;
    case "booth":
      return undefined;
  }
}

function buildWebsiteUrl(raw?: string): string | undefined {
  const v = normalizeMaybeUrl(raw);
  if (!v) return undefined;

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
    console.error("[aura/form/submit][GET test_openai] error", e);
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

  // ✅ 重要：requestId 指定時は最初に所有権チェック（IDOR遮断）
  let ownedRec: any | null = null;
  if (requestId) {
    const access = await requireAuraRequestAccess(requestId, req);
    if (!access.ok) return access.response;
    ownedRec = access.rec;

    // 事故防止：公開済みは submit で draft に戻して全上書きさせない
    if (ownedRec?.status === "published") {
      return NextResponse.json(
        { ok: false, error: "already_published", message: "公開済みのため再送信で上書きできません" },
        { status: 403 }
      );
    }
  }

  // 2) ✅ Zod parse 前に SNS を退避（schema外キーは parse で落ちるため）
  const raw = payload && typeof payload === "object" ? (payload as any) : {};

  const rawSocial =
    raw.social && typeof raw.social === "object" ? raw.social : undefined;

  const pick = (key: string): string | undefined => {
    const v1 = typeof raw[key] === "string" ? raw[key].trim() : "";
    const v2 =
      rawSocial && typeof rawSocial[key] === "string"
        ? String(rawSocial[key]).trim()
        : "";
    return v1 ? v1 : v2 ? v2 : undefined;
  };

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

  const normalizedSocial = {
    xUrl: buildPlatformUrl("x", rawX),
    instagramUrl: buildPlatformUrl("instagram", rawIg),
    pixivUrl: buildPlatformUrl("pixiv", rawPixiv),
    skebUrl: buildPlatformUrl("skeb", rawSkeb),
    boothUrl: buildWebsiteUrl(rawBooth),
    websiteUrl: buildWebsiteUrl(rawWebsite),
    portfolioUrl: buildWebsiteUrl(rawPortfolio),
  };

  const rescuedLinksRaw = Array.isArray(raw.links) ? raw.links : undefined;
  const rescuedSocialLinksRaw = Array.isArray(raw.socialLinks)
    ? raw.socialLinks
    : undefined;
  const rescuedSnsArrayRaw = Array.isArray(raw.sns) ? raw.sns : undefined;

  // 3) Zod parse
  const parsed = FormInputSchema.safeParse(payload);
  if (!parsed.success) {
    console.error(
      "aura: invalid form payload",
      parsed.error.issues,
      payload
    );
    return NextResponse.json(
      { ok: false, error: "invalid", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // 4) ✅ parse後に復元して formInput を作る
  const rebuiltSocialObj = rawSocial
    ? {
        ...rawSocial,
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
    social: normalizedSocialObj,
    ...normalizedSocial,
    ...(rescuedLinksRaw ? { links: rescuedLinksRaw } : {}),
    ...(rescuedSocialLinksRaw ? { socialLinks: rescuedSocialLinksRaw } : {}),
    ...(rescuedSnsArrayRaw ? { sns: rescuedSnsArrayRaw } : {}),
  };


  // ------------------------------------------------------------
  // 1) id を確定（draft 連携 or 新規）
  // ------------------------------------------------------------
  let id: string | null = null;

  // ✅ requestId がある場合：所有権チェック済みなので、そのIDに上書き（IDOR不可）
  if (requestId) {
    const { error: updDraftErr } = await supabase
      .from("aura_requests")
      .update({
        status: "draft",
        error: null,
        payload: formInput as unknown as Json,
        design: null,
        content: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updDraftErr) {
      console.error("[aura/form/submit] update draft failed", updDraftErr);
      return NextResponse.json(
        { ok: false, error: "update_draft_failed" },
        { status: 500 }
      );
    }

    id = requestId;
  }

  // ✅ requestId が無い場合：新規作成し session_token 発行 + Cookie付与
  let issuedSessionToken: string | null = null;

  if (!id) {
    issuedSessionToken = randomUUID();

    const { data: created, error: insErr } = await supabase
      .from("aura_requests")
      .insert({
        status: "draft",
        error: null,
        payload: formInput as unknown as Json,
        design: null,
        content: null,
        slug: null,
        public_slug: null,
        email: (formInput as any)?.email ?? null,

        // ✅ 所有確認用
        session_token: issuedSessionToken,
      })
      .select("id")
      .single();

    if (insErr || !created?.id) {
      console.error("[aura/form/submit] insert failed", insErr);
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

    // ✅ 新規作成時のみ Cookie を返す（HttpOnly / requestId単位）
    const res = NextResponse.json({ ok: true, id, status: "generated" });

    if (issuedSessionToken) {
      res.headers.append("Set-Cookie", buildAuraSessionCookie(id, issuedSessionToken));
    }

    return res;
  } catch (e: any) {
    const message = e?.message ?? String(e);
    console.error("[aura/form/submit] generate error", e);

    await supabase
      .from("aura_requests")
      .update({
        status: "error",
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    // ✅ 新規作成時でも Cookie は返しておく（失敗しても同じ draft を継続利用できる）
    const res = NextResponse.json(
      { ok: false, id, status: "error", error: "generate_failed", message },
      { status: 200 }
    );

    if (issuedSessionToken) {
      res.headers.append("Set-Cookie", buildAuraSessionCookie(id, issuedSessionToken));
    }

    return res;
  }
}
