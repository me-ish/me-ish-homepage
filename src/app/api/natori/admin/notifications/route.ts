import { NextResponse } from "next/server";
import { z } from "zod";
import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
import { listAcceptanceNotifications, retryAcceptanceNotification } from "@/features/natori/server/notificationManagement";
import { checkCsrf } from "@/lib/auth/csrf";
import { checkRateLimit, getIpFromRequest, rateLimitExceeded } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export const GET = withNatoriManagement("notifications.GET", false, async (request?: Request) => {
  const offset = Number(request ? new URL(request.url).searchParams.get("offset") ?? 0 : 0);
  if (!Number.isInteger(offset) || offset < 0 || offset > 100000) return NextResponse.json({ error: "invalid_offset" }, { status: 400, headers });
  try { return NextResponse.json(await listAcceptanceNotifications(offset), { headers }); }
  catch { return NextResponse.json({ error: "notification_read_failed" }, { status: 503, headers }); }
});

export const POST = withNatoriManagement("notifications.POST", true, async (request: Request) => {
  const csrf = checkCsrf(request);
  if (csrf) return csrf;
  const rate = await checkRateLimit(`natori-notification-retry:${getIpFromRequest(request)}`, { limit: 10, windowMs: 600000 });
  if (!rate.allowed) return rateLimitExceeded(rate.retryAfterMs);
  const input = z.object({ id: z.uuid() }).strict().safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "invalid_id" }, { status: 400, headers });
  try {
    if (!await retryAcceptanceNotification(input.data.id)) return NextResponse.json({ error: "retry_unavailable" }, { status: 409, headers });
    return NextResponse.json({ ok: true }, { headers });
  } catch { return NextResponse.json({ error: "retry_unconfirmed" }, { status: 503, headers }); }
});
