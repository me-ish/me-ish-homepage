import { NextRequest, NextResponse } from "next/server";
import { safeCompare } from "@/lib/auth/timingSafe";
import { expireNatoriPaymentLinks } from "@/features/natori/server/paymentLinkExpiryService";
import { retireCasePaymentReceipts } from "@/features/natori/server/casePaymentReceiptRetention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader && safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    return true;
  }

  const token = req.headers.get("x-meish-admin-token");
  const adminToken = process.env.ADMIN_API_TOKEN;
  return Boolean(adminToken && token && safeCompare(token, adminToken));
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Keep receipt cleanup independent of Stripe availability and never suppress existing expiry work.
  const receiptRetirement = await retireCasePaymentReceipts().catch(() => ({ error: "receipt_retirement_unavailable" }));
  const result = await expireNatoriPaymentLinks();
  if (result.kind === "not-configured") {
    return NextResponse.json({ error: "Stripe is not configured", receiptRetirement }, { status: 503 });
  }
  if (result.kind === "db-error") {
    return NextResponse.json({ error: "Failed to inspect payment links", receiptRetirement }, { status: 500 });
  }

  return NextResponse.json({ ok: !("error" in receiptRetirement), ...result, receiptRetirement }, { status: "error" in receiptRetirement ? 500 : 200 });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
