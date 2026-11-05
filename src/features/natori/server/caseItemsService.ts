import "server-only";

// features/natori/server/caseItemsService.ts
// 案件の品目の読み書き。所有者の確認と、しまった案件への書き込み拒否をここで行う。
// 見積・支払い・納品・案件本体（natori_projects）の行は一切書き換えない。
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveNatoriOwnerId } from "@/features/natori/server/natoriOwner";
import { nextCaseItemPosition, type CaseItemFields } from "@/features/natori/lib/caseItems";
import type { NatoriCaseItem } from "@/features/natori/types/caseItems";
import type { NatoriConcreteProjectType } from "@/features/natori/types/projects";

const COLUMNS =
  "id, project_id, position, title, project_type, amount, due_date, progress, publication_policy, publication_allowed_from, note, updated_at";

type ItemRow = {
  id: string;
  project_id: string;
  position: number;
  title: string;
  project_type: string | null;
  amount: number | null;
  due_date: string | null;
  progress: NatoriCaseItem["progress"];
  publication_policy: NatoriCaseItem["publicationPolicy"];
  publication_allowed_from: string | null;
  note: string | null;
  updated_at: string;
};

export type CaseItemsResult =
  | { kind: "ok"; items: NatoriCaseItem[] }
  | { kind: "not-found" }
  | { kind: "project-archived" }
  | { kind: "item-limit-exceeded" }
  | { kind: "conflict" }
  | { kind: "db-error" };

const TYPES: readonly string[] = ["icon", "sd", "standing", "illustration"];

function toItem(row: ItemRow): NatoriCaseItem {
  return {
    id: row.id,
    projectId: row.project_id,
    position: row.position,
    title: row.title,
    projectType: row.project_type && TYPES.includes(row.project_type) ? (row.project_type as NatoriConcreteProjectType) : null,
    amount: row.amount,
    dueDate: row.due_date,
    progress: row.progress,
    publicationPolicy: row.publication_policy,
    publicationAllowedFrom: row.publication_allowed_from,
    note: row.note,
    updatedAt: row.updated_at,
  };
}

function toRow(fields: CaseItemFields) {
  return {
    title: fields.title,
    project_type: fields.projectType,
    amount: fields.amount,
    due_date: fields.dueDate,
    progress: fields.progress,
    publication_policy: fields.publicationPolicy,
    publication_allowed_from: fields.publicationAllowedFrom,
    note: fields.note,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505";
}

async function projectScope(projectId: string, write: boolean): Promise<{ kind: "ok" } | Exclude<CaseItemsResult, { kind: "ok" }>> {
  const ownerId = await resolveNatoriOwnerId();
  if (!ownerId) return { kind: "not-found" };
  const { data, error } = await supabaseAdmin()
    .from("natori_projects")
    .select("id, deleted_at")
    .eq("id", projectId)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (error) {
    console.error("[natori-case-items] project scope lookup failed");
    return { kind: "db-error" };
  }
  if (!data) return { kind: "not-found" };
  if (write && (data as { deleted_at: string | null }).deleted_at) return { kind: "project-archived" };
  return { kind: "ok" };
}

async function readItems(projectId: string): Promise<CaseItemsResult> {
  const { data, error } = await supabaseAdmin()
    .from("natori_case_items")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) {
    console.error("[natori-case-items] read failed");
    return { kind: "db-error" };
  }
  return { kind: "ok", items: ((data ?? []) as ItemRow[]).map(toItem) };
}

/** 一覧。しまった案件も見るだけはできる。 */
export async function listNatoriCaseItems(projectId: string): Promise<CaseItemsResult> {
  const scope = await projectScope(projectId, false);
  if (scope.kind !== "ok") return scope;
  return readItems(projectId);
}

/** 品目をいちばん後ろに足す。同時に足された場合は conflict を返す（もう一度読み直してから）。 */
export async function addNatoriCaseItem(projectId: string, fields: CaseItemFields): Promise<CaseItemsResult> {
  const scope = await projectScope(projectId, true);
  if (scope.kind !== "ok") return scope;
  const current = await readItems(projectId);
  if (current.kind !== "ok") return current;
  const position = nextCaseItemPosition(current.items);
  if (position === null) return { kind: "item-limit-exceeded" };
  const { error } = await supabaseAdmin()
    .from("natori_case_items")
    .insert({ project_id: projectId, position, ...toRow(fields) });
  if (error) {
    if (isUniqueViolation(error)) return { kind: "conflict" };
    console.error("[natori-case-items] insert failed");
    return { kind: "db-error" };
  }
  return readItems(projectId);
}

/** 品目を直す。読んだあとにほかの画面で変わっていたら保存しない。 */
export async function updateNatoriCaseItem(
  projectId: string,
  itemId: string,
  expectedUpdatedAt: string,
  fields: CaseItemFields,
): Promise<CaseItemsResult> {
  const scope = await projectScope(projectId, true);
  if (scope.kind !== "ok") return scope;
  const { data, error } = await supabaseAdmin()
    .from("natori_case_items")
    .update(toRow(fields))
    .eq("id", itemId)
    .eq("project_id", projectId)
    .eq("updated_at", expectedUpdatedAt)
    .select("id");
  if (error) {
    console.error("[natori-case-items] update failed");
    return { kind: "db-error" };
  }
  if (!data?.length) return { kind: "conflict" };
  return readItems(projectId);
}

/** 品目を消す。位置は詰めない。 */
export async function deleteNatoriCaseItem(
  projectId: string,
  itemId: string,
  expectedUpdatedAt: string,
): Promise<CaseItemsResult> {
  const scope = await projectScope(projectId, true);
  if (scope.kind !== "ok") return scope;
  const { data, error } = await supabaseAdmin()
    .from("natori_case_items")
    .delete()
    .eq("id", itemId)
    .eq("project_id", projectId)
    .eq("updated_at", expectedUpdatedAt)
    .select("id");
  if (error) {
    console.error("[natori-case-items] delete failed");
    return { kind: "db-error" };
  }
  if (!data?.length) return { kind: "conflict" };
  return readItems(projectId);
}
