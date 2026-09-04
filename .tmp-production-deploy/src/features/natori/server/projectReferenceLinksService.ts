import "server-only";

// features/natori/server/projectReferenceLinksService.ts
// 外部参照リンクの CRUD。owner scope と archive guard をここで担保し、
// URL 正規化・重複判定は referenceLinks.ts / projectReferenceLinks.ts に委ねる。
//
// 一貫性の方針:
// P1-07 は add / edit / delete のみを提供する。いずれも単一 SQL 文で完結し、
// 部分適用が残らない。delete all + insert all は行わない。
//
// 並び替えは複数行の sort_order を書き換える必要があり、application 層の
// 逐次 UPDATE では途中失敗時に部分適用が残って原子性を保証できない。
// P1-07 は migration なしが条件のため、原子的な RPC を伴う並び替えは
// 後続工程へ分離した（このモジュールに reorder は存在しない）。
//
// sort_order の扱い:
// - 追加は max(既存 sort_order) + 1（件数ではない。欠番があっても末尾に付く）
// - 削除後に詰め直さない。欠番は許容する
// - 編集で sort_order は変更しない
// - 読み出しは sort_order ASC, created_at ASC で決定的
//
// URL には一切アクセスしない（fetch / metadata / OGP / redirect 追跡なし）。
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveNatoriActingUserId } from "@/features/natori/server/natoriOwner";
import {
  NATORI_PROJECT_REFERENCE_LINK_MAX,
  nextNatoriReferenceLinkSortOrder,
  normalizeNatoriReferenceLinkSet,
  type NatoriReferenceLinkDraft,
} from "@/features/natori/lib/projectReferenceLinks";
import {
  deleteProjectReferenceLink,
  insertProjectReferenceLink,
  selectProjectReferenceLinks,
  updateProjectReferenceLink,
  type NatoriProjectReferenceLinkRow,
} from "@/features/natori/server/referenceLinkTableAdapter";

export type NatoriProjectReferenceLink = {
  id: string;
  url: string;
  normalizedUrl: string;
  label: string | null;
  sortOrder: number;
  createdAt: string;
};

export type ReferenceLinkServiceResult =
  | { kind: "ok"; links: NatoriProjectReferenceLink[] }
  | { kind: "not-found" }
  | { kind: "project-archived" }
  | { kind: "link-limit-exceeded" }
  | { kind: "duplicate-link" }
  | { kind: "invalid-link" }
  | { kind: "db-error" };

function toLink(row: NatoriProjectReferenceLinkRow): NatoriProjectReferenceLink {
  return {
    id: row.id,
    url: row.url,
    normalizedUrl: row.normalized_url,
    label: row.label,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

type ProjectScope =
  | { kind: "ok"; ownerId: string }
  | { kind: "not-found" }
  | { kind: "project-archived" }
  | { kind: "db-error" };

/**
 * acting owner を解決し、対象 project がその owner のものかを確認する。
 * archived (deleted_at IS NOT NULL) は mutation 不可として区別する。
 */
async function resolveProjectScope(
  projectId: string,
  { allowArchived }: { allowArchived: boolean }
): Promise<ProjectScope> {
  const ownerId = await resolveNatoriActingUserId();
  if (!ownerId) return { kind: "not-found" };

  const { data, error } = await supabaseAdmin()
    .from("natori_projects")
    .select("id, deleted_at")
    .eq("id", projectId)
    .eq("user_id", ownerId)
    .maybeSingle();

  if (error) {
    console.error("[natori-reference-links] project scope lookup failed");
    return { kind: "db-error" };
  }
  if (!data) return { kind: "not-found" };
  const archived = Boolean((data as { deleted_at: string | null }).deleted_at);
  if (archived && !allowArchived) return { kind: "project-archived" };
  return { kind: "ok", ownerId };
}

async function currentLinks(
  projectId: string
): Promise<{ kind: "ok"; links: NatoriProjectReferenceLink[] } | { kind: "db-error" }> {
  const result = await selectProjectReferenceLinks(projectId);
  if (result.kind === "db-error") return { kind: "db-error" };
  return { kind: "ok", links: result.value.map(toLink) };
}

/** 一覧取得。archived project でも閲覧は既存の archive 契約に合わせて許可する。 */
export async function listNatoriProjectReferenceLinks(
  projectId: string
): Promise<ReferenceLinkServiceResult> {
  const scope = await resolveProjectScope(projectId, { allowArchived: true });
  if (scope.kind !== "ok") return scope;
  return currentLinks(projectId);
}

export type AddNatoriProjectReferenceLinkInput = {
  projectId: string;
  url: string;
  label: string | null;
};

export async function addNatoriProjectReferenceLink(
  input: AddNatoriProjectReferenceLinkInput
): Promise<ReferenceLinkServiceResult> {
  const scope = await resolveProjectScope(input.projectId, { allowArchived: false });
  if (scope.kind !== "ok") return scope;

  const existing = await currentLinks(input.projectId);
  if (existing.kind === "db-error") return { kind: "db-error" };

  const drafts: NatoriReferenceLinkDraft[] = [
    ...existing.links.map((link) => ({ id: link.id, url: link.url, label: link.label })),
    { id: null, url: input.url, label: input.label },
  ];
  const validated = normalizeNatoriReferenceLinkSet(drafts);
  if (!validated.ok) {
    if (validated.error.code === "link_limit_exceeded") {
      return { kind: "link-limit-exceeded" };
    }
    if (validated.error.code === "duplicate_link") return { kind: "duplicate-link" };
    return { kind: "invalid-link" };
  }

  const added = validated.links[validated.links.length - 1];
  const inserted = await insertProjectReferenceLink({
    projectId: input.projectId,
    url: added.url,
    normalizedUrl: added.normalizedUrl,
    label: added.label,
    // 件数ではなく既存最大値 + 1。欠番（0, 2, 5）でも末尾に付く。
    sortOrder: nextNatoriReferenceLinkSortOrder(existing.links),
  });
  if (inserted.kind === "duplicate") return { kind: "duplicate-link" };
  if (inserted.kind !== "ok") return { kind: "db-error" };

  return currentLinks(input.projectId);
}

export type UpdateNatoriProjectReferenceLinkInput = {
  projectId: string;
  linkId: string;
  url: string;
  label: string | null;
};

export async function updateNatoriProjectReferenceLink(
  input: UpdateNatoriProjectReferenceLinkInput
): Promise<ReferenceLinkServiceResult> {
  const scope = await resolveProjectScope(input.projectId, { allowArchived: false });
  if (scope.kind !== "ok") return scope;

  const existing = await currentLinks(input.projectId);
  if (existing.kind === "db-error") return { kind: "db-error" };
  if (!existing.links.some((link) => link.id === input.linkId)) {
    return { kind: "not-found" };
  }

  // 変更後の最終セット全体で重複を判定する。
  const drafts: NatoriReferenceLinkDraft[] = existing.links.map((link) =>
    link.id === input.linkId
      ? { id: link.id, url: input.url, label: input.label }
      : { id: link.id, url: link.url, label: link.label }
  );
  const validated = normalizeNatoriReferenceLinkSet(drafts);
  if (!validated.ok) {
    if (validated.error.code === "duplicate_link") return { kind: "duplicate-link" };
    if (validated.error.code === "link_limit_exceeded") {
      return { kind: "link-limit-exceeded" };
    }
    return { kind: "invalid-link" };
  }

  const target = validated.links.find((link) => link.id === input.linkId);
  if (!target) return { kind: "not-found" };

  // url と normalized_url は必ず同一 UPDATE で書き、片方だけ進む状態を作らない。
  const updated = await updateProjectReferenceLink(input.projectId, input.linkId, {
    url: target.url,
    normalized_url: target.normalizedUrl,
    label: target.label,
  });
  if (updated.kind === "duplicate") return { kind: "duplicate-link" };
  if (updated.kind === "not-found") return { kind: "not-found" };
  if (updated.kind !== "ok") return { kind: "db-error" };

  return currentLinks(input.projectId);
}

/**
 * 削除は単一 DELETE で完結する。
 * 残った link の sort_order は詰め直さない（欠番を許容する）。詰め直しは
 * 複数行 UPDATE になり、途中失敗で部分適用が残るため P1-07 では行わない。
 */
export async function deleteNatoriProjectReferenceLink(
  projectId: string,
  linkId: string
): Promise<ReferenceLinkServiceResult> {
  const scope = await resolveProjectScope(projectId, { allowArchived: false });
  if (scope.kind !== "ok") return scope;

  const removed = await deleteProjectReferenceLink(projectId, linkId);
  if (removed.kind === "not-found") return { kind: "not-found" };
  if (removed.kind !== "ok") return { kind: "db-error" };

  return currentLinks(projectId);
}

export { NATORI_PROJECT_REFERENCE_LINK_MAX };
