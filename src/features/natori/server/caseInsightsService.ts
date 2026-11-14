import "server-only";

// features/natori/server/caseInsightsService.ts
// 案件ごとの「振り返り用の記録」の読み書き。所有者の確認をここで行う。
// 見積・支払い・納品・案件本体（natori_projects）の行は一切書き換えない。
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveNatoriOwnerId } from "@/features/natori/server/natoriOwner";
import {
  CASE_CLOSE_REASONS, CASE_SOURCES, EMPTY_CASE_INSIGHTS,
  type CaseCloseReason, type CaseInsights, type CaseSource,
} from "@/features/natori/lib/caseInsights";

export type CaseInsightsResult =
  | { kind: "ok"; insights: CaseInsights }
  | { kind: "not-found" }
  | { kind: "db-error" };

type Row = { source: string | null; close_reason: string | null; repeat_client: boolean | null };

function toInsights(row: Row | null): CaseInsights {
  if (!row) return EMPTY_CASE_INSIGHTS;
  return {
    source: (CASE_SOURCES as readonly string[]).includes(row.source ?? "") ? (row.source as CaseSource) : null,
    closeReason: (CASE_CLOSE_REASONS as readonly string[]).includes(row.close_reason ?? "") ? (row.close_reason as CaseCloseReason) : null,
    repeatClient: row.repeat_client,
  };
}

async function ownsProject(projectId: string, ownerId?: string): Promise<"ok" | "not-found" | "db-error"> {
  const owner = ownerId ?? (await resolveNatoriOwnerId());
  if (!owner) return "not-found";
  const { data, error } = await supabaseAdmin()
    .from("natori_projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", owner)
    .maybeSingle();
  if (error) {
    console.error("[natori-case-insights] project scope lookup failed");
    return "db-error";
  }
  return data ? "ok" : "not-found";
}

async function read(projectId: string): Promise<CaseInsightsResult> {
  const { data, error } = await supabaseAdmin()
    .from("natori_case_insights")
    .select("source, close_reason, repeat_client")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) {
    console.error("[natori-case-insights] read failed");
    return { kind: "db-error" };
  }
  return { kind: "ok", insights: toInsights(data as Row | null) };
}

/**
 * 同じメールアドレスの、これより前の案件がまだ残っているか。
 * 匿名化された案件はアドレスが消えているので当たらない（そのぶんは担当者が手で印をつける）。
 */
async function hasEarlierCaseWithSameEmail(projectId: string, ownerId: string): Promise<boolean> {
  const admin = supabaseAdmin();
  const { data: current } = await admin
    .from("natori_projects")
    .select("client_email, created_at")
    .eq("id", projectId)
    .eq("user_id", ownerId)
    .maybeSingle();
  const email = (current as { client_email: string | null } | null)?.client_email?.trim();
  const createdAt = (current as { created_at: string } | null)?.created_at;
  if (!email || !createdAt) return false;
  const { count, error } = await admin
    .from("natori_projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ownerId)
    .ilike("client_email", email.replace(/[\\%_]/g, "\\$&"))
    .neq("id", projectId)
    .lt("created_at", createdAt);
  return !error && (count ?? 0) > 0;
}

/** 読む。まだ印が無く、同じアドレスの前の案件が残っていれば「2 回目以降」を入れておく。 */
export async function getNatoriCaseInsights(projectId: string): Promise<CaseInsightsResult> {
  const ownerId = await resolveNatoriOwnerId();
  if (!ownerId) return { kind: "not-found" };
  const scope = await ownsProject(projectId, ownerId);
  if (scope !== "ok") return { kind: scope };
  const current = await read(projectId);
  if (current.kind !== "ok" || current.insights.repeatClient !== null) return current;
  if (!(await hasEarlierCaseWithSameEmail(projectId, ownerId))) return current;
  return updateNatoriCaseInsights(projectId, { repeatClient: true }, ownerId);
}

/** 渡された項目だけを書き換える。行が無ければ作る。 */
export async function updateNatoriCaseInsights(
  projectId: string,
  patch: Partial<CaseInsights>,
  ownerId?: string,
): Promise<CaseInsightsResult> {
  const scope = await ownsProject(projectId, ownerId);
  if (scope !== "ok") return { kind: scope };
  const row: { project_id: string; updated_at: string; source?: string | null; close_reason?: string | null; repeat_client?: boolean | null } = {
    project_id: projectId,
    updated_at: new Date().toISOString(),
  };
  if (patch.source !== undefined) row.source = patch.source;
  if (patch.closeReason !== undefined) row.close_reason = patch.closeReason;
  if (patch.repeatClient !== undefined) row.repeat_client = patch.repeatClient;
  const { error } = await supabaseAdmin().from("natori_case_insights").upsert(row, { onConflict: "project_id" });
  if (error) {
    console.error("[natori-case-insights] write failed");
    return { kind: "db-error" };
  }
  return read(projectId);
}
