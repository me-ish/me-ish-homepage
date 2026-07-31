// api/natori/maintenance/inquiry-orphans/route.ts
// ご依頼資料 (natori-inquiry-refs) の Storage orphan 棚卸し。
//
// 既存の /api/cron/* と同じ認証方式（CRON_SECRET または ADMIN_API_TOKEN）を使う
// 運用者トリガーの maintenance endpoint。P1-06 では vercel.json に schedule を
// 追加せず、Preview / 運用者手動での実行だけを可能にする。定期実行の有効化は
// P1-13 の release gate で判断する。
//
// - GET  … dry-run 固定（副作用なし）
// - POST … dryRun=0 を明示したときだけ削除する
import { NextRequest, NextResponse } from "next/server";
import { safeCompare } from "@/lib/auth/timingSafe";
import {
  NATORI_ORPHAN_DEFAULT_MAX_DELETIONS,
  NATORI_ORPHAN_DEFAULT_MIN_AGE_MS,
  scanNatoriInquiryReferenceOrphans,
} from "@/features/natori/server/inquiryOrphanService";

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
  if (adminToken && token && safeCompare(token, adminToken)) return true;
  return false;
}

function readPositiveInt(value: string | null, fallback: number, max: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

async function handle(req: NextRequest, allowDeletion: boolean) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  // 既定は dry-run。削除は POST かつ dryRun=0 の明示指定のときだけ。
  const dryRun = !allowDeletion || params.get("dryRun") !== "0";
  const minimumAgeHours = readPositiveInt(params.get("minAgeHours"), 24, 24 * 90);
  const maxDeletions = readPositiveInt(
    params.get("limit"),
    NATORI_ORPHAN_DEFAULT_MAX_DELETIONS,
    NATORI_ORPHAN_DEFAULT_MAX_DELETIONS
  );

  const result = await scanNatoriInquiryReferenceOrphans({
    dryRun,
    minimumAgeMs: Math.max(minimumAgeHours * 60 * 60 * 1000, NATORI_ORPHAN_DEFAULT_MIN_AGE_MS),
    maxDeletions,
  });

  if (result.kind === "unavailable") {
    // 台帳・Storage が読めない場合は object を保持したまま失敗を返す。
    return NextResponse.json({ ok: false, error: "scan_unavailable" }, { status: 503 });
  }
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: NextRequest) {
  return handle(req, false);
}

export async function POST(req: NextRequest) {
  return handle(req, true);
}
