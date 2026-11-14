import "server-only";

// features/natori/server/caseAnonymizationService.ts
// 依頼者情報の匿名化。DB の書き換えは関数 natori_case_anonymize_v1 が 1 回の処理で行い、
// ここでは呼び出しと、関数が返したファイル（相談の添付・参考画像・納品データ）の削除を行う。
// ファイルを消し終えたら natori_case_anonymizations.storage_purged_at を入れる。消せなかったら次の回にやり直す。
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Json } from "@/types/supabase";
import { resolveNatoriManagementContext, resolveNatoriOwnerId } from "./natoriOwner";
import { resolveTrustedNatoriOwnerId } from "./trustedNatoriOwner";
import type { NatoriOperator } from "./natoriManagementScope";
import {
  NATORI_ANONYMIZE_AFTER_DAYS, anonymizeRpcResult, anonymizeStorageObject, groupStorageObjects, scheduledAnonymizeDate,
  type AnonymizeRpcResult, type AnonymizeStorageObject, type CaseAnonymizationStatus,
} from "../lib/caseAnonymization";

type Operator = NatoriOperator | { kind: "schedule" };

export type AnonymizeOutcome =
  | { kind: "applied" | "already"; label: string; filesRemoved: boolean }
  | { kind: "not-found" | "not-eligible" | "too-early" | "busy" | "invalid" }
  | { kind: "db-error" };

async function callAnonymize(ownerId: string, projectId: string, kind: "scheduled" | "manual", operator: Operator): Promise<AnonymizeRpcResult | null> {
  const { data, error } = await supabaseAdmin().rpc("natori_case_anonymize_v1", {
    p_owner: ownerId, p_project: projectId, p_input: { kind, operator } as unknown as Json,
  });
  if (error) {
    console.error("[natori-anonymize] rpc failed");
    return null;
  }
  const parsed = anonymizeRpcResult.safeParse(data);
  if (!parsed.success) {
    console.error("[natori-anonymize] unexpected rpc result");
    return null;
  }
  return parsed.data;
}

/** ファイルを消して、消し終えた印を入れる。全部消せたら true。 */
async function purgeFiles(projectId: string, objects: AnonymizeStorageObject[]): Promise<boolean> {
  const admin = supabaseAdmin();
  for (const group of groupStorageObjects(objects)) {
    const { error } = await admin.storage.from(group.bucket).remove(group.paths);
    if (error) {
      console.error("[natori-anonymize] storage remove failed", group.bucket);
      return false;
    }
  }
  const { error } = await admin
    .from("natori_case_anonymizations")
    .update({ storage_purged_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .is("storage_purged_at", null);
  if (error) {
    console.error("[natori-anonymize] purge mark failed");
    return false;
  }
  return true;
}

async function anonymizeOne(ownerId: string, projectId: string, kind: "scheduled" | "manual", operator: Operator): Promise<AnonymizeOutcome> {
  const result = await callAnonymize(ownerId, projectId, kind, operator);
  if (!result) return { kind: "db-error" };
  if (result.result !== "applied" && result.result !== "already") return { kind: result.result };
  const filesRemoved = result.storagePurged || (await purgeFiles(projectId, result.storage));
  return { kind: result.result, label: result.label, filesRemoved };
}

/** 案件画面の「今すぐ匿名化」。完了・見送りの案件なら 90 日を待たない。操作した人を記録に残す。 */
export async function anonymizeNatoriCaseNow(projectId: string): Promise<AnonymizeOutcome> {
  const { ownerId, operator } = await resolveNatoriManagementContext();
  return anonymizeOne(ownerId, projectId, "manual", operator);
}

/** 案件画面に出す状態。 */
export async function readNatoriCaseAnonymization(projectId: string): Promise<CaseAnonymizationStatus | null> {
  const ownerId = await resolveNatoriOwnerId();
  const admin = supabaseAdmin();
  const { data: project, error } = await admin
    .from("natori_projects")
    .select("id, status, completed_at, updated_at")
    .eq("id", projectId)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (error || !project) return null;
  const { data: row, error: rowError } = await admin
    .from("natori_case_anonymizations")
    .select("label, anonymized_at, storage_purged_at")
    .eq("project_id", projectId)
    .maybeSingle();
  if (rowError) return null;
  if (row) return { state: "done", label: row.label, anonymizedAt: row.anonymized_at, filesRemoved: row.storage_purged_at !== null };
  const p = project as { status: string; completed_at: string | null; updated_at: string };
  const scheduledFrom = scheduledAnonymizeDate(p.status, p.completed_at, p.updated_at);
  return { state: "not-yet", eligible: scheduledFrom !== null, scheduledFrom };
}

export type ScheduledAnonymizeReport = {
  checked: number;
  applied: number;
  skipped: number;
  failed: number;
  filesRetried: number;
  filesPending: number;
};

/** 毎日の処理：完了（見送り）から 90 日たった案件を匿名化し、消し残したファイルを消し直す。1 回あたり件数を絞る。 */
export async function runScheduledNatoriAnonymization(limit = 25): Promise<ScheduledAnonymizeReport | null> {
  // 毎日の処理はログインした人がいないので、設定された所有者だけを対象にする。
  const owner = resolveTrustedNatoriOwnerId();
  if (owner.kind !== "ok") return null;
  const ownerId = owner.ownerId;
  const admin = supabaseAdmin();
  const report: ScheduledAnonymizeReport = { checked: 0, applied: 0, skipped: 0, failed: 0, filesRetried: 0, filesPending: 0 };

  // 前の回に消し残したファイル
  const { data: pending, error: pendingError } = await admin
    .from("natori_case_anonymizations")
    .select("project_id, storage_objects")
    .eq("owner_id", ownerId)
    .is("storage_purged_at", null)
    .limit(limit);
  if (pendingError) return null;
  for (const row of pending ?? []) {
    const objects = anonymizeStorageObject.array().safeParse(row.storage_objects);
    report.filesRetried++;
    if (!objects.success || !(await purgeFiles(row.project_id, objects.data))) report.filesPending++;
  }

  const cutoff = new Date(Date.now() - NATORI_ANONYMIZE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: done, error: doneError } = await admin.from("natori_case_anonymizations").select("project_id").eq("owner_id", ownerId);
  if (doneError) return null;
  const skip = new Set((done ?? []).map((r) => r.project_id));
  // 完了日があればそれ、なければ最終更新で絞る。正確な判定は DB の関数がもう一度行う。
  const { data: candidates, error } = await admin
    .from("natori_projects")
    .select("id, completed_at, updated_at")
    .eq("user_id", ownerId)
    .in("status", ["completed", "closed"])
    .or(`completed_at.lt.${cutoff},and(completed_at.is.null,updated_at.lt.${cutoff})`)
    .order("updated_at", { ascending: true })
    .limit(limit + skip.size);
  if (error) return null;
  for (const c of (candidates ?? []).filter((c) => !skip.has(c.id)).slice(0, limit)) {
    report.checked++;
    const outcome = await anonymizeOne(ownerId, c.id, "scheduled", { kind: "schedule" });
    if (outcome.kind === "applied") {
      report.applied++;
      if (!outcome.filesRemoved) report.filesPending++;
    } else if (outcome.kind === "db-error") report.failed++;
    else report.skipped++;
  }
  return report;
}
