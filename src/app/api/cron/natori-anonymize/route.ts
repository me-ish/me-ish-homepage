// 毎日の処理：
//   1. 納品ページの保存期限が過ぎても受け取りが押されなかった案件を完了にする
//   2. 完了（見送り）から 90 日たった案件の依頼者情報を匿名化する
// 1 を先に行うので、完了になった案件はその日（保存期限の日）から 90 日を数え始める。
import { NextRequest, NextResponse } from "next/server";
import { safeCompare } from "@/lib/auth/timingSafe";
import { runScheduledNatoriAnonymization } from "@/features/natori/server/caseAnonymizationService";
import { runScheduledNatoriDeemedCompletion } from "@/features/natori/server/scheduledCaseCompletion";

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
  // 完了の処理が失敗しても、匿名化は続ける（どちらかが失敗したら 500 を返して気づけるようにする）。
  const completion = await runScheduledNatoriDeemedCompletion().catch(() => null);
  const report = await runScheduledNatoriAnonymization().catch(() => null);
  if (!report) return NextResponse.json({ error: "anonymization_unavailable", completion }, { status: 500 });
  const ok = report.failed === 0 && report.filesPending === 0 && completion !== null && completion.failed === 0;
  return NextResponse.json({ ok, ...report, completion }, { status: ok ? 200 : 500 });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
