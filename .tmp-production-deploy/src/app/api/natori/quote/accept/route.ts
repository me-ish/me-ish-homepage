// api/natori/quote/accept/route.ts
// 見積もり承諾ページの「この内容でお願いする」ボタンからの確定。
// 公開エンドポイント（トークンが資格情報）。業務ロジックは quoteAcceptService に集約。
import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { checkRateLimit, getIpFromRequest, rateLimitExceeded } from "@/lib/rateLimit";
import { acceptNatoriQuote } from "@/features/natori/server/quoteAcceptService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const csrfErr = checkCsrf(req);
  if (csrfErr) return csrfErr;

  const ip = getIpFromRequest(req);
  const rl = await checkRateLimit(`natori-quote-accept:${ip}`, {
    limit: 10,
    windowMs: 600_000,
  });
  if (!rl.allowed) return rateLimitExceeded(rl.retryAfterMs);

  const payload = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof payload?.token === "string" ? payload.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const result = await acceptNatoriQuote(token);
  switch (result.kind) {
    case "not-found":
      return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
    case "expired":
      return NextResponse.json({ error: "quote_expired" }, { status: 410 });
    case "db-error":
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    case "already-accepted":
      return NextResponse.json({ ok: true, already: true });
    case "ok":
      return NextResponse.json({ ok: true });
  }
}
