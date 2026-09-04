// src/lib/apiResponse.ts
// 統一的な API レスポンスヘルパー
//
// 使い方:
//   return apiOk({ id: "123" });
//   return apiErr("not_found", 404);
//   return apiErr("validation_failed", 400, issues);

import { NextResponse } from "next/server";

type ApiOkBody = { ok: true } & Record<string, unknown>;
type ApiErrBody = { ok: false; error: string; details?: unknown };

/**
 * 成功レスポンス (200)
 */
export function apiOk(data?: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ok: true, ...data } as ApiOkBody, { status });
}

/**
 * エラーレスポンス
 * @param error  機械可読なエラーコード（例: "not_found", "csrf_rejected"）
 * @param status HTTP ステータスコード
 * @param details 追加情報（Zod issues 等）。本番では含めない方が安全。
 */
export function apiErr(error: string, status = 400, details?: unknown) {
  const body: ApiErrBody = { ok: false, error };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status });
}
