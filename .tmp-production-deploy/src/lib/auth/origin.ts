// src/lib/auth/origin.ts
// 同一オリジン検証。CSRF ヘッダー (checkCsrf) と併用する二重化で、
// ブラウザが Origin を付けるクロスサイト送信を拒否する。
//
// Origin ヘッダーが無いリクエスト（同一オリジンの一部 navigation、
// curl や server-to-server）は既存挙動を維持するために許可する。
// 判定は header だけで行い、外部への問い合わせはしない。

import { NextResponse } from "next/server";

function hostOfUrl(value: string): string | null {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

function expectedHosts(req: Request): Set<string> {
  const hosts = new Set<string>();
  const forwarded = req.headers.get("x-forwarded-host");
  if (forwarded) hosts.add(forwarded.split(",")[0].trim().toLowerCase());
  const host = req.headers.get("host");
  if (host) hosts.add(host.trim().toLowerCase());

  const siteHost = process.env.NEXT_PUBLIC_SITE_URL
    ? hostOfUrl(process.env.NEXT_PUBLIC_SITE_URL)
    : null;
  if (siteHost) hosts.add(siteHost);

  const vercelHost = process.env.VERCEL_URL?.trim().toLowerCase();
  if (vercelHost) hosts.add(vercelHost);

  const requestHost = hostOfUrl(req.url);
  if (requestHost) hosts.add(requestHost);

  return hosts;
}

/**
 * Origin ヘッダーがあり、かつ配信ホストと一致しない場合だけ 403 を返す。
 * 一致・不在の場合は null（通過）。
 */
export function checkSameOrigin(req: Request): NextResponse | null {
  const origin = req.headers.get("origin");
  if (!origin || origin === "null") return null;

  const originHost = hostOfUrl(origin);
  if (originHost && expectedHosts(req).has(originHost)) return null;

  return NextResponse.json(
    { ok: false, error: "origin_rejected" },
    { status: 403 }
  );
}
