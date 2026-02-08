// src/lib/auth/csrf.ts
// CSRF保護: x-requested-with ヘッダーの検証

import { NextResponse } from "next/server";

const EXPECTED_HEADER = "me-ish";

/**
 * クライアントからの fetch に付与するヘッダー。
 * スプレッドで使う: `headers: { ...CSRF_HEADERS, 'Content-Type': '...' }`
 */
export const CSRF_HEADERS = { "x-requested-with": EXPECTED_HEADER } as const;

/**
 * CSRF ヘッダーを検証する。
 * 不正な場合は 403 レスポンスを返す。正常な場合は null を返す。
 */
export function checkCsrf(req: Request): NextResponse | null {
  const header = req.headers.get("x-requested-with");
  if (header === EXPECTED_HEADER) return null;
  return NextResponse.json(
    { ok: false, error: "csrf_rejected" },
    { status: 403 },
  );
}
