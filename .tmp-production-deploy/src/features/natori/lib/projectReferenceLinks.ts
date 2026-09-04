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

/**
 * 検証済みの link。sort_order は含めない。
 * 並び替えは原子的に行えないため P1-07 では扱わず、追加時のみ
 * service が max(sort_order) + 1 を決める。
 */
export type NatoriNormalizedReferenceLink = {
  id: string | null;
  url: string;
  normalizedUrl: string;
  label: string | null;
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
 * 保存直前の最終セット全体を検証する（件数・URL 正規化・重複・label 長）。
 * 部分更新ではなく最終セットで重複を判定するため、URL 変更で一時的に
 * 重複が生まれる経路を塞げる。sort_order はここでは決めない。
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
    });
  }

  return { ok: true, links };
}

/**
 * 新規追加の sort_order。既存の最大値 + 1 を使う。
 * 件数をそのまま使うと欠番（0, 2, 5）のときに既存の途中へ割り込むため。
 * link が 0 件なら 0。safe integer を超える場合は既存最大値を据え置く。
 */
export function nextNatoriReferenceLinkSortOrder(
  existing: Array<{ sortOrder: number }>
): number {
  if (existing.length === 0) return 0;
  const max = existing.reduce(
    (current, link) => (link.sortOrder > current ? link.sortOrder : current),
    0
  );
  if (!Number.isSafeInteger(max) || max + 1 > Number.MAX_SAFE_INTEGER) return max;
  return max + 1;
}

/**
 * 表示順を決定的にする。sort_order には unique 制約が無く欠番も同値もあり得るため、
 * created_at を第2キーにして同順位でも並びがぶれないようにする。
 */
export function sortNatoriReferenceLinks<
  T extends { sortOrder: number; createdAt?: string },
>(links: T[]): T[] {
  return [...links].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
  });
}
