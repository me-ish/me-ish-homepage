import "server-only";

// features/natori/server/scheduledCaseCompletion.ts
// 毎日の処理：納品ページの保存期限が過ぎても「受け取りました」が押されなかった案件を完了にする。
// 規約の「保存期限が過ぎた時点で納品完了とみなします」を、画面の状態にも反映するためのもの。
// 完了にしてよいかどうか（期限の延長を含む）は DB の関数 natori_case_complete_v1 がもう一度確かめる。
// ここでは候補を選んで呼ぶだけで、案件の行は直接書き換えない。
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Json } from "@/types/supabase";
import { resolveTrustedNatoriOwnerId } from "./trustedNatoriOwner";

export const SCHEDULED_COMPLETION_NOTE = "納品ページの保存期限が過ぎたため、自動で完了にしました。";

export type ScheduledCompletionReport = { checked: number; applied: number; skipped: number; failed: number };

type Rpc = (
  name: "natori_case_complete_v1" | "natori_case_work_revision_v1",
  args: Record<string, Json | undefined>,
) => PromiseLike<{ data: unknown; error: unknown }>;

const completionResult = z.object({
  result: z.enum(["applied", "already-completed", "not-eligible", "not-expired", "stale", "conflict", "inactive", "invalid", "not-found"]),
});

/** 保存期限が過ぎて、まだ受け取りの記録がない案件を完了にする。1 回あたり件数を絞る。 */
export async function runScheduledNatoriDeemedCompletion(limit = 25): Promise<ScheduledCompletionReport | null> {
  // 毎日の処理はログインした人がいないので、設定された所有者だけを対象にする。
  const owner = resolveTrustedNatoriOwnerId();
  if (owner.kind !== "ok") return null;
  const admin = supabaseAdmin();
  const rpc = admin.rpc.bind(admin) as unknown as Rpc;
  const report: ScheduledCompletionReport = { checked: 0, applied: 0, skipped: 0, failed: 0 };

  // 最初の期限で粗く絞る。延長されていれば、DB の関数が「まだ期限前」と返す。
  const { data: releases, error: releaseError } = await admin
    .from("natori_delivery_releases")
    .select("project_id")
    .is("accepted_at", null)
    .lt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true })
    .limit(200);
  if (releaseError) return null;
  const projectIds = (releases ?? []).map((row) => row.project_id);
  if (projectIds.length === 0) return report;

  const { data: projects, error: projectError } = await admin
    .from("natori_projects")
    .select("id")
    .eq("user_id", owner.ownerId)
    .eq("status", "delivered")
    .is("completed_at", null)
    .is("deleted_at", null)
    .in("id", projectIds)
    .limit(limit);
  if (projectError) return null;

  for (const project of projects ?? []) {
    report.checked++;
    const revision = await rpc("natori_case_work_revision_v1", { p_project: project.id });
    if (revision.error || typeof revision.data !== "string") {
      report.failed++;
      continue;
    }
    const { data, error } = await rpc("natori_case_complete_v1", {
      p_owner: owner.ownerId,
      p_project: project.id,
      p_input: {
        requestId: randomUUID(), revision: revision.data, kind: "deemed",
        note: SCHEDULED_COMPLETION_NOTE, operator: { kind: "schedule" },
      } as Json,
    });
    const parsed = error ? null : completionResult.safeParse(data);
    if (!parsed?.success) {
      console.error("[natori-deemed-completion] rpc failed");
      report.failed++;
    } else if (parsed.data.result === "applied") report.applied++;
    else if (parsed.data.result === "invalid") {
      // ここから送る内容は決まっているので、「invalid」は DB 側がまだ毎日の処理を受け付けていない
      // （本番の SQL が未適用）ことを意味する。黙って飛ばさず、失敗として気づけるようにする。
      console.error("[natori-deemed-completion] schedule operator rejected");
      report.failed++;
    } else report.skipped++;
  }
  return report;
}
