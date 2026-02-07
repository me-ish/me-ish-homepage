// src/app/admin/api/entries/sync-display-ready/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminEmail } from "@/lib/isAdmin";
import path from "node:path";

export const revalidate = 0;

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !isAdminEmail(user.email)) return null;
  return user;
}

function ensureTrailingSlash(u: string) {
  return u.endsWith("/") ? u : `${u}/`;
}

export async function POST() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();

  // ✅ confirmed=true で display_ready=false のものだけ同期対象
  // （必要なら confirmed 条件を外してもOKだが、運用上はこれが安全）
  const { data: targets, error: qErr } = await admin
    .from("entries")
    .select("id,file_name,is_for_sale,display_plan,plan_payment_status,gallery_type")
    .eq("confirmed", true)
    .eq("display_ready", false)
    .limit(200);

  if (qErr) return NextResponse.json({ error: "query_failed" }, { status: 500 });

  const rows = targets ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, skipped: 0, skippedReasons: {} });
  }

  // 画像処理ジョブのステータスを一括取得
  const entryIds = rows.map((r) => (r as any).id as number);
  const { data: jobs } = await admin
    .from("entry_processing_jobs")
    .select("entry_id, status")
    .in("entry_id", entryIds);

  const jobStatusMap = new Map<number, string>();
  for (const j of jobs ?? []) {
    jobStatusMap.set(j.entry_id, j.status);
  }

  // public URL を deterministic に組む（list を毎回叩かない＝高速）
  // 注意: NEXT_PUBLIC_SUPABASE_URL が無い環境なら SUPABASE_URL を用意しておく
  const base =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "";
  if (!base) {
    return NextResponse.json({ error: "missing_supabase_url_env" }, { status: 500 });
  }
  const SUPABASE_URL = ensureTrailingSlash(base);

  let updated = 0;
  let skipped = 0;
  const skippedReasons: Record<string, number> = {};

  const countSkip = (reason: string) => {
    skipped++;
    skippedReasons[reason] = (skippedReasons[reason] ?? 0) + 1;
  };

  for (const e of rows) {
    const entryId = (e as any).id as number;

    // ✅ 画像処理ジョブが succeeded でなければスキップ
    const jobStatus = jobStatusMap.get(entryId);
    if (jobStatus !== "succeeded") {
      countSkip(`job_${jobStatus ?? "not_found"}`);
      continue;
    }

    const paidPlan =
      (e as any).is_for_sale === true &&
      String((e as any).display_plan ?? "free") !== "free";
    const planPaid = String((e as any).plan_payment_status ?? "").toLowerCase() === "paid";
    if (paidPlan && !planPaid) {
      countSkip("payment_pending");
      continue;
    }

    const fileName = (e as any).file_name as string | null;
    if (!fileName) {
      countSkip("no_file_name");
      continue;
    }

    const stem = path.parse(fileName).name; // 1769..._usachan
    const finalName = `${stem}.png`;
    const objectPath = `artworks/final/${finalName}`;
    const publicUrl = `${SUPABASE_URL}storage/v1/object/public/${objectPath}`;

    // Note: DO_EXISTENCE_CHECK は廃止。processing_job.status で判断する。

    // 展示期間を設定: display_ready=true のタイミングで開始
    const now = new Date();
    const galleryType = String((e as any).gallery_type ?? "").toLowerCase();
    const isWhiteGallery = galleryType === "white";

    // White Gallery は無期限、それ以外は1ヶ月後に終了
    let displayEndAt: string | null = null;
    if (!isWhiteGallery) {
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 1);
      displayEndAt = endDate.toISOString();
    }

    const plan = String((e as any).display_plan ?? "free").toLowerCase();
    const guaranteeMap: Record<string, number> = {
      mini: 4,
      light: 9,
      standard: 14,
      premium: 30,
      free: 0,
    };
    const guaranteeTotal = guaranteeMap[plan] ?? 0;
    const guaranteeRemaining = guaranteeTotal > 0 ? guaranteeTotal : 0;
    const guaranteePeriodStart = guaranteeTotal > 0 ? now.toISOString() : null;
    const guaranteePeriodEnd = guaranteeTotal > 0 ? displayEndAt : null;

    const { error: uErr } = await admin
      .from("entries")
      .update({
        image_url: publicUrl,
        display_ready: true,
        display_start_at: now.toISOString(),
        display_end_at: displayEndAt,
        guarantee_total: guaranteeTotal,
        guarantee_remaining: guaranteeRemaining,
        guarantee_period_start: guaranteePeriodStart,
        guarantee_period_end: guaranteePeriodEnd,
      })
      .eq("id", (e as any).id);

    if (uErr) {
      countSkip("update_failed");
      continue;
    }
    updated++;
  }

  return NextResponse.json({ ok: true, updated, skipped, skippedReasons });
}
