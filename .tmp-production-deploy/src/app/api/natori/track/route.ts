// api/natori/track/route.ts
// ナトリ公開ページのクリック計測。公開エンドポイントなので
// CSRFヘッダー + IPレート制限 + イベント種別の allowlist で絞る。
// 計測なので失敗しても常に 2xx/4xx を静かに返す（UI には影響させない前提）。
import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { checkRateLimit, getIpFromRequest, rateLimitExceeded } from "@/lib/rateLimit";
import {
  NATORI_PAGE_EVENTS,
  recordNatoriPageEvent,
} from "@/features/natori/server/pageEventsService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const csrfErr = checkCsrf(req);
  if (csrfErr) return csrfErr;

  const ip = getIpFromRequest(req);
  const rl = await checkRateLimit(`natori-track:${ip}`, { limit: 60, windowMs: 600_000 });
  if (!rl.allowed) return rateLimitExceeded(rl.retryAfterMs);

  const payload = (await req.json().catch(() => null)) as {
    event?: unknown;
    label?: unknown;
    path?: unknown;
  } | null;
  const event = typeof payload?.event === "string" ? payload.event : "";
  const label = typeof payload?.label === "string" ? payload.label : "";
  const path = typeof payload?.path === "string" ? payload.path : "";

  if (!NATORI_PAGE_EVENTS.has(event) || label.length > 100 || path.length > 200) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await recordNatoriPageEvent({ event, label, path });
  return NextResponse.json({ ok: true });
}
