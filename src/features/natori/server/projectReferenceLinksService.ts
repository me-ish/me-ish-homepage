import "server-only";

// features/natori/server/projectReferenceLinksService.ts
// 外部参照リンクの CRUD。owner scope と archive guard をここで担保し、
// URL 正規化・重複判定は referenceLinks.ts / projectReferenceLinks.ts に委ねる。
//
// 一貫性の方針:
// natori_project_reference_links の unique 制約は (project_id, normalized_url)
// だけで sort_order には無いため、並び替えは sort_order の逐次 UPDATE で行える。
// add / edit / delete はいずれも単文で原子的、reorder は途中失敗しても
// 並び順が乱れるだけで link を失わない（読み出しは sort_order, created_at 順で
// 決定的、再実行で復旧する）。delete all + insert all は行わない。
//
// URL には一切アクセスしない（fetch / metadata / OGP / redirect 追跡なし）。
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveNatoriActingUserId } from "@/features/natori/server/natoriOwner";
import {
  NATORI_PROJECT_REFERENCE_LINK_MAX,
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
    sortOrder: added.sortOrder,
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

export async function deleteNatoriProjectReferenceLink(
  projectId: string,
  linkId: string
): Promise<ReferenceLinkServiceResult> {
  const scope = await resolveProjectScope(projectId, { allowArchived: false });
  if (scope.kind !== "ok") return scope;

  const removed = await deleteProjectReferenceLink(projectId, linkId);
  if (removed.kind === "not-found") return { kind: "not-found" };
  if (removed.kind !== "ok") return { kind: "db-error" };

  // 削除後に 0..n-1 へ詰め直す。途中で失敗しても link は失われず、
  // 並びが乱れるだけなので再実行で回復できる。
  const remaining = await currentLinks(projectId);
  if (remaining.kind === "db-error") return { kind: "db-error" };
  await applySortOrder(projectId, remaining.links);

  return currentLinks(projectId);
}

/**
 * 並び替え。link の追加・削除は行わず sort_order だけを書き換える。
 * orderedIds は現在の link 集合と完全に一致している必要がある。
 */
export async function reorderNatoriProjectReferenceLinks(
  projectId: string,
  orderedIds: string[]
): Promise<ReferenceLinkServiceResult> {
  const scope = await resolveProjectScope(projectId, { allowArchived: false });
  if (scope.kind !== "ok") return scope;

  const existing = await currentLinks(projectId);
  if (existing.kind === "db-error") return { kind: "db-error" };

  const existingIds = new Set(existing.links.map((link) => link.id));
  const requestedIds = new Set(orderedIds);
  if (
    orderedIds.length !== existing.links.length ||
    requestedIds.size !== orderedIds.length ||
    orderedIds.some((id) => !existingIds.has(id))
  ) {
    // 集合が一致しない指示は、link を失う恐れがあるため適用しない。
    return { kind: "not-found" };
  }

  const byId = new Map(existing.links.map((link) => [link.id, link]));
  const ordered = orderedIds
    .map((id) => byId.get(id))
    .filter((link): link is NatoriProjectReferenceLink => Boolean(link));

  const failed = await applySortOrder(projectId, ordered);
  if (failed) return { kind: "db-error" };

  return currentLinks(projectId);
}

/** sort_order を 0..n-1 へ揃える。失敗したかどうかだけを返す。 */
async function applySortOrder(
  projectId: string,
  ordered: NatoriProjectReferenceLink[]
): Promise<boolean> {
  let failed = false;
  for (const [index, link] of ordered.entries()) {
    if (link.sortOrder === index) continue;
    const result = await updateProjectReferenceLink(projectId, link.id, {
      sort_order: index,
    });
    if (result.kind !== "ok") failed = true;
  }
  return failed;
}

export { NATORI_PROJECT_REFERENCE_LINK_MAX };
