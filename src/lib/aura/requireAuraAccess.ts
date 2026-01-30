// src/lib/aiPortfolio/requireAuraAccess.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/aura/supabaseAdmin";

export type AuraAccessResult =
  | { ok: true; rec: any }
  | { ok: false; response: NextResponse };

/**
 * Cookie名を生成（requestIdごとに分離）
 */
export function auraSessionCookieName(requestId: string): string {
  return `aura_st_${requestId}`;
}

/**
 * セッショントークンCookieを設定するためのSet-Cookie値を生成
 */
export function buildAuraSessionCookie(
  requestId: string,
  sessionToken: string
): string {
  const name = auraSessionCookieName(requestId);
  const isProduction = process.env.NODE_ENV === "production";
  const secure = isProduction ? "; Secure" : "";
  // Max-Age: 7日
  // tokenはUUID想定だが念のため encode
  const v = encodeURIComponent(sessionToken);
  return `${name}=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`;
}

/**
 * Cookieヘッダを手動パース（Route Handler外やテストの保険）
 */
function readCookieFromHeader(cookieHeader: string, name: string): string | null {
  // シンプルなcookieパース（= 以降を値とみなす）
  const parts = cookieHeader.split(";").map((s) => s.trim());
  for (const p of parts) {
    if (!p) continue;
    const i = p.indexOf("=");
    if (i <= 0) continue;
    const k = p.slice(0, i);
    if (k === name) return decodeURIComponent(p.slice(i + 1));
  }
  return null;
}

/**
 * AURA リクエストへのアクセス権を検証
 * - Cookie `aura_st_{requestId}` から session_token を取得
 * - DB の session_token と照合
 *
 * NOTE:
 * - ルート内（Route Handler）では req を渡さなくても動く（cookies()）
 * - ただし汎用性のため req を渡せる形にしている
 */
export async function requireAuraRequestAccess(
  requestId: string,
  req?: Request
): Promise<AuraAccessResult> {
  const cookieName = auraSessionCookieName(requestId);

  // 1) Cookie から session_token を取得
  let sessionToken: string | null = null;

  if (req) {
    const cookieHeader = req.headers.get("cookie") ?? "";
    sessionToken = readCookieFromHeader(cookieHeader, cookieName);
  } else {
    // Route Handlerの暗黙コンテキスト
    const cookieStore = cookies();
    sessionToken = cookieStore.get(cookieName)?.value ?? null;
    sessionToken = sessionToken ? decodeURIComponent(sessionToken) : null;
  }

  if (!sessionToken) {
    const isProduction = process.env.NODE_ENV === "production";
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "unauthorized",
          message: isProduction ? "session token required" : `session token required (cookie: ${cookieName})`,
        },
        { status: 401 }
      ),
    };
  }

  // 2) DB照合（id + session_token で一致必須）
  const admin = supabaseAdmin();
  const { data: rec, error } = await admin
    .from("aura_requests")
    // * ではなく必要最小限（必要なら後で増やす）
    .select("id,status,email,payload,content,design,public_slug,published_at,payment_status,session_token")
    .eq("id", requestId)
    .eq("session_token", sessionToken)
    .maybeSingle();

  if (error || !rec) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "forbidden", message: "invalid or expired session token" },
        { status: 403 }
      ),
    };
  }

  return { ok: true, rec };
}
