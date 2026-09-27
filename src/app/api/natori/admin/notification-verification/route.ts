import { NextResponse } from "next/server";
import { z } from "zod";
import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
import { notificationVerificationAvailable, verifyNotificationMail } from "@/features/natori/server/notificationVerification";
import { VERIFICATION_PURPOSES } from "@/features/natori/types/notificationVerification";
import { checkCsrf } from "@/lib/auth/csrf";
import { checkRateLimit, getIpFromRequest, rateLimitExceeded } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store" };

export const GET = withNatoriManagement("notification-verification.GET", false, async (_request: Request) => {
  if (!notificationVerificationAvailable()) return NextResponse.json({ error: "verification_closed" }, { status: 404, headers });
  return NextResponse.json({ available: true }, { headers });
});

export const POST = withNatoriManagement("notification-verification.POST", true, async (request: Request) => {
  const csrf = checkCsrf(request);
  if (csrf) return csrf;
  if (!notificationVerificationAvailable()) return NextResponse.json({ error: "verification_closed" }, { status: 404, headers });
  const rate = await checkRateLimit(`natori-notification-verification:${getIpFromRequest(request)}`, { limit: 5, windowMs: 600000 });
  if (!rate.allowed) return rateLimitExceeded(rate.retryAfterMs);
  const input = z.object({ purpose: z.enum(["all", ...VERIFICATION_PURPOSES]) }).strict().safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "invalid_verification" }, { status: 400, headers });
  try { return NextResponse.json({ results: await verifyNotificationMail(input.data.purpose) }, { headers }); }
  catch { return NextResponse.json({ error: "verification_unconfirmed" }, { status: 503, headers }); }
});
