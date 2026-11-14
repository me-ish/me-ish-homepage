// 毎日の処理：完了（見送り）から 90 日たった案件の依頼者情報を匿名化する。
import { NextRequest, NextResponse } from "next/server";
import { safeCompare } from "@/lib/auth/timingSafe";
import { runScheduledNatoriAnonymization } from "@/features/natori/server/caseAnonymizationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader && safeCompare(authHeader, `Bearer ${cronSecret}`)) return true;
  const token = req.headers.get("x-meish-admin-token");
  const adminToken = process.env.ADMIN_API_TOKEN;
  return Boolean(adminToken && token && safeCompare(token, adminToken));
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const report = await runScheduledNatoriAnonymization().catch(() => null);
  if (!report) return NextResponse.json({ error: "anonymization_unavailable" }, { status: 500 });
  const ok = report.failed === 0 && report.filesPending === 0;
  return NextResponse.json({ ok, ...report }, { status: ok ? 200 : 500 });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
