// src/lib/card/requireCardAccess.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type CardAccessResult =
  | { ok: true; rec: any }
  | { ok: false; response: NextResponse };

/**
 * Cookie name per request (isolated per card request)
 */
export function cardSessionCookieName(requestId: string): string {
  return `card_st_${requestId}`;
}

/**
 * Build Set-Cookie value for session token
 */
export function buildCardSessionCookie(
  requestId: string,
  sessionToken: string,
): string {
  const name = cardSessionCookieName(requestId);
  const isProduction = process.env.NODE_ENV === "production";
  const secure = isProduction ? "; Secure" : "";
  const v = encodeURIComponent(sessionToken);
  return `${name}=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`;
}

/**
 * Parse cookie from raw header
 */
function readCookieFromHeader(
  cookieHeader: string,
  name: string,
): string | null {
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
 * Verify access to a card request via session token cookie
 */
export async function requireCardRequestAccess(
  requestId: string,
  req?: Request,
): Promise<CardAccessResult> {
  const cookieName = cardSessionCookieName(requestId);

  let sessionToken: string | null = null;

  if (req) {
    const cookieHeader = req.headers.get("cookie") ?? "";
    sessionToken = readCookieFromHeader(cookieHeader, cookieName);
  } else {
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
          message: isProduction
            ? "session token required"
            : `session token required (cookie: ${cookieName})`,
        },
        { status: 401 },
      ),
    };
  }

  const admin = supabaseAdmin();
  const { data: rec, error } = await admin
    .from("card_requests")
    .select(
      "id,status,email,payload,content,design,public_slug,public_id,published_at,payment_status,tier,session_token",
    )
    .eq("id", requestId)
    .eq("session_token", sessionToken)
    .maybeSingle();

  if (error || !rec) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "forbidden",
          message: "invalid or expired session token",
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true, rec };
}
