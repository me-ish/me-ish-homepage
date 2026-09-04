// 外部参照リンクの最終セット検証と sort_order の決め方。
// P1-07 は並び替えを提供しないため、sort_order は追加時にのみ決まる。
import { describe, expect, it } from "vitest";
import * as projectReferenceLinks from "@/features/natori/lib/projectReferenceLinks";
import {
  NATORI_PROJECT_REFERENCE_LINK_MAX,
  nextNatoriReferenceLinkSortOrder,
  normalizeNatoriReferenceLinkSet,
  sortNatoriReferenceLinks,
} from "@/features/natori/lib/projectReferenceLinks";

describe("nextNatoriReferenceLinkSortOrder", () => {
  it("link が 0 件なら 0", () => {
    expect(nextNatoriReferenceLinkSortOrder([])).toBe(0);
  });

  it("欠番があっても max + 1（件数は使わない）", () => {
    // 0, 2, 5 の3件。件数 3 だと既存の途中へ割り込む。
    const existing = [{ sortOrder: 0 }, { sortOrder: 2 }, { sortOrder: 5 }];
    expect(nextNatoriReferenceLinkSortOrder(existing)).toBe(6);
    expect(nextNatoriReferenceLinkSortOrder(existing)).not.toBe(existing.length);
  });

  it("重複した sort_order があっても max + 1", () => {
    expect(nextNatoriReferenceLinkSortOrder([{ sortOrder: 3 }, { sortOrder: 3 }])).toBe(4);
  });

  it("safe integer 範囲を超えない", () => {
    expect(
      nextNatoriReferenceLinkSortOrder([{ sortOrder: Number.MAX_SAFE_INTEGER }])
    ).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe("sortNatoriReferenceLinks", () => {
  it("sort_order 昇順、同値は created_at 昇順で決定的に並べる", () => {
    const links = [
      { id: "c", sortOrder: 5, createdAt: "2026-08-03T00:00:00.000Z" },
      { id: "a", sortOrder: 0, createdAt: "2026-08-01T00:00:00.000Z" },
      { id: "b2", sortOrder: 2, createdAt: "2026-08-04T00:00:00.000Z" },
      { id: "b1", sortOrder: 2, createdAt: "2026-08-02T00:00:00.000Z" },
    ];
    expect(sortNatoriReferenceLinks(links).map((link) => link.id)).toEqual([
      "a",
      "b1",
      "b2",
      "c",
    ]);
  });

  it("欠番があっても順序は保たれる", () => {
    const links = [
      { id: "b", sortOrder: 5, createdAt: "2026-08-02T00:00:00.000Z" },
      { id: "a", sortOrder: 0, createdAt: "2026-08-01T00:00:00.000Z" },
    ];
    expect(sortNatoriReferenceLinks(links).map((link) => link.id)).toEqual(["a", "b"]);
  });
});

describe("normalizeNatoriReferenceLinkSet", () => {
  it("sort_order を決めない（追加時に service が決める）", () => {
    const result = normalizeNatoriReferenceLinkSet([
      { id: null, url: "https://example.com/a", label: null },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.links[0]).not.toHaveProperty("sortOrder");
  });

  it("HTTPS 以外・credentials 付きを拒否する", () => {
    for (const url of ["http://example.com/a", "https://user:pass@example.com/a"]) {
      const result = normalizeNatoriReferenceLinkSet([{ id: null, url, label: null }]);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("invalid_link");
    }
  });

  it("normalize 後の重複を最終セット全体で判定する", () => {
    const result = normalizeNatoriReferenceLinkSet([
      { id: "a", url: "https://example.com/a", label: null },
      { id: "b", url: "https://EXAMPLE.com:443/a#frag", label: null },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ code: "duplicate_link", index: 1 });
  });

  it("fragment 除去・default port 除去・query 順序維持", () => {
    const result = normalizeNatoriReferenceLinkSet([
      { id: null, url: "HTTPS://EXAMPLE.COM:443/a/?b=2&a=1#preview", label: null },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.links[0].normalizedUrl).toBe("https://example.com/a/?b=2&a=1");
  });

  it("上限件数と label 長を検証する", () => {
    const tooMany = Array.from({ length: NATORI_PROJECT_REFERENCE_LINK_MAX + 1 }, (_, i) => ({
      id: null,
      url: `https://example.com/${i}`,
      label: null,
    }));
    const limit = normalizeNatoriReferenceLinkSet(tooMany);
    expect(limit.ok).toBe(false);
    if (limit.ok) return;
    expect(limit.error.code).toBe("link_limit_exceeded");

    const longLabel = normalizeNatoriReferenceLinkSet([
      { id: null, url: "https://example.com/a", label: "あ".repeat(101) },
    ]);
    expect(longLabel.ok).toBe(false);
    if (longLabel.ok) return;
    expect(longLabel.error.code).toBe("label_too_long");
  });
});

describe("並び替えヘルパを提供しない", () => {
  it("move 系の export が無い", () => {
    expect(
      (projectReferenceLinks as Record<string, unknown>).moveNatoriReferenceLink
    ).toBeUndefined();
    expect(
      Object.keys(projectReferenceLinks).some((key) =>
        /move|reorder/i.test(key)
      )
    ).toBe(false);
  });
});
