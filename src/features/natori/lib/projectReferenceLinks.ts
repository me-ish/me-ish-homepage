// features/natori/lib/projectReferenceLinks.ts
// 外部参照リンクの「最終セット」検証と sort_order 正規化。
// URL の正規化規則は referenceLinks.ts を唯一の真実源として使い、
// ここでは件数・重複・label 長・並び順だけを扱う。
// URL へのアクセス（fetch / metadata / OGP / redirect 追跡）は一切行わない。
// DB・fetch・process.env には依存しない純関数だけを置く。
import { normalizeNatoriReferenceUrl } from "@/features/natori/lib/referenceLinks";

export const NATORI_PROJECT_REFERENCE_LINK_MAX = 5;
export const NATORI_REFERENCE_LINK_LABEL_MAX_LENGTH = 100;

export type NatoriReferenceLinkDraft = {
  /** 既存 row の id。新規追加は null。 */
  id: string | null;
  url: string;
  label: string | null;
};

export type NatoriNormalizedReferenceLink = {
  id: string | null;
  url: string;
  normalizedUrl: string;
  label: string | null;
  sortOrder: number;
};

export type NatoriReferenceLinkSetError =
  | { code: "link_limit_exceeded"; index: null }
  | { code: "invalid_link"; index: number }
  | { code: "duplicate_link"; index: number }
  | { code: "label_too_long"; index: number };

export type NatoriReferenceLinkSetResult =
  | { ok: true; links: NatoriNormalizedReferenceLink[] }
  | { ok: false; error: NatoriReferenceLinkSetError };

/**
 * 保存直前の最終セットを検証し、sort_order を 0..n-1 へ振り直す。
 * 部分更新ではなく最終セット全体で重複を判定するため、並び替えや
 * URL 変更で一時的に重複が生まれる経路を塞げる。
 */
export function normalizeNatoriReferenceLinkSet(
  drafts: NatoriReferenceLinkDraft[]
): NatoriReferenceLinkSetResult {
  if (drafts.length > NATORI_PROJECT_REFERENCE_LINK_MAX) {
    return { ok: false, error: { code: "link_limit_exceeded", index: null } };
  }

  const links: NatoriNormalizedReferenceLink[] = [];
  const seen = new Set<string>();

  for (const [index, draft] of drafts.entries()) {
    const url = draft.url.trim();
    const normalizedUrl = normalizeNatoriReferenceUrl(url);
    if (!normalizedUrl) {
      return { ok: false, error: { code: "invalid_link", index } };
    }
    if (seen.has(normalizedUrl)) {
      return { ok: false, error: { code: "duplicate_link", index } };
    }
    seen.add(normalizedUrl);

    const label = draft.label === null ? null : draft.label.trim();
    if (label !== null && label.length > NATORI_REFERENCE_LINK_LABEL_MAX_LENGTH) {
      return { ok: false, error: { code: "label_too_long", index } };
    }

    links.push({
      id: draft.id,
      url,
      normalizedUrl,
      label: label && label.length > 0 ? label : null,
      sortOrder: index,
    });
  }

  return { ok: true, links };
}

/** 表示・保存の並び順を安定させる（sort_order 同値は作成順で解決）。 */
export function sortNatoriReferenceLinks<
  T extends { sortOrder: number; createdAt?: string },
>(links: T[]): T[] {
  return [...links].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
  });
}

/** 並び替え UI 用。範囲外の移動は元配列をそのまま返す。 */
export function moveNatoriReferenceLink<T>(links: T[], from: number, to: number): T[] {
  if (from === to) return links;
  if (from < 0 || from >= links.length) return links;
  if (to < 0 || to >= links.length) return links;
  const next = [...links];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
