// 外部参照リンク CRUD。owner scope / archive guard / 正規化 / 件数上限 /
// 重複拒否 / sort_order 0..n-1 / 失敗時に既存集合を失わないことを固定する。
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  mockResolveOwner,
  mockProjectLookup,
  mockSelect,
  mockInsert,
  mockUpdate,
  mockDelete,
} = vi.hoisted(() => ({
  mockResolveOwner: vi.fn(),
  mockProjectLookup: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("@/features/natori/server/natoriOwner", () => ({
  resolveNatoriActingUserId: (...args: unknown[]) => mockResolveOwner(...args),
  NATORI_OWNER_UNRESOLVED_MESSAGE: "",
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: () => mockProjectLookup() }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/features/natori/server/referenceLinkTableAdapter", () => ({
  selectProjectReferenceLinks: (...args: unknown[]) => mockSelect(...args),
  insertProjectReferenceLink: (...args: unknown[]) => mockInsert(...args),
  updateProjectReferenceLink: (...args: unknown[]) => mockUpdate(...args),
  deleteProjectReferenceLink: (...args: unknown[]) => mockDelete(...args),
  selectReferenceLinksForProjects: vi.fn(),
}));

import * as referenceLinksService from "@/features/natori/server/projectReferenceLinksService";
import {
  addNatoriProjectReferenceLink,
  deleteNatoriProjectReferenceLink,
  listNatoriProjectReferenceLinks,
  updateNatoriProjectReferenceLink,
} from "@/features/natori/server/projectReferenceLinksService";

const PROJECT_ID = "2ef91cb1-e0a3-4f32-b846-a0d8c6bbf44c";
const OWNER_ID = "a2823bd4-9b9a-4ae0-b408-e2d131c2ba09";

function row(index: number, url: string, id = `link-${index}`) {
  return {
    id,
    project_id: PROJECT_ID,
    url,
    normalized_url: url.toLowerCase(),
    label: `資料${index}`,
    provider: null,
    sort_order: index,
    created_at: `2026-08-0${index + 1}T00:00:00.000Z`,
  };
}

function stubLinks(rows: ReturnType<typeof row>[]) {
  mockSelect.mockResolvedValue({ kind: "ok", value: rows });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveOwner.mockResolvedValue(OWNER_ID);
  mockProjectLookup.mockResolvedValue({
    data: { id: PROJECT_ID, deleted_at: null },
    error: null,
  });
  stubLinks([]);
  mockInsert.mockResolvedValue({ kind: "ok" });
  mockUpdate.mockResolvedValue({ kind: "ok" });
  mockDelete.mockResolvedValue({ kind: "ok" });
});

describe("owner scope / archive", () => {
  it("owner が解決できなければ not-found", async () => {
    mockResolveOwner.mockResolvedValue(null);
    await expect(listNatoriProjectReferenceLinks(PROJECT_ID)).resolves.toEqual({
      kind: "not-found",
    });
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("owner 不一致（別 owner の project）は not-found", async () => {
    mockProjectLookup.mockResolvedValue({ data: null, error: null });
    await expect(
      addNatoriProjectReferenceLink({
        projectId: PROJECT_ID,
        url: "https://example.com/a",
        label: null,
      })
    ).resolves.toEqual({ kind: "not-found" });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("archived project の変更は拒否し、閲覧だけ許可する", async () => {
    mockProjectLookup.mockResolvedValue({
      data: { id: PROJECT_ID, deleted_at: "2026-08-01T00:00:00.000Z" },
      error: null,
    });
    await expect(
      addNatoriProjectReferenceLink({
        projectId: PROJECT_ID,
        url: "https://example.com/a",
        label: null,
      })
    ).resolves.toEqual({ kind: "project-archived" });
    await expect(
      deleteNatoriProjectReferenceLink(PROJECT_ID, "link-0")
    ).resolves.toEqual({ kind: "project-archived" });
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();

    const listed = await listNatoriProjectReferenceLinks(PROJECT_ID);
    expect(listed.kind).toBe("ok");
  });
});

describe("add", () => {
  it("正規化した URL と sort_order を付けて追加する", async () => {
    stubLinks([row(0, "https://example.com/a")]);
    await addNatoriProjectReferenceLink({
      projectId: PROJECT_ID,
      url: "HTTPS://EXAMPLE.COM:443/b#frag",
      label: " 追加資料 ",
    });
    expect(mockInsert).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      url: "HTTPS://EXAMPLE.COM:443/b#frag",
      normalizedUrl: "https://example.com/b",
      label: "追加資料",
      sortOrder: 1,
    });
  });

  it("HTTP は拒否する", async () => {
    await expect(
      addNatoriProjectReferenceLink({
        projectId: PROJECT_ID,
        url: "http://example.com/a",
        label: null,
      })
    ).resolves.toEqual({ kind: "invalid-link" });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("credentials 付き URL は拒否する", async () => {
    await expect(
      addNatoriProjectReferenceLink({
        projectId: PROJECT_ID,
        url: "https://user:pass@example.com/a",
        label: null,
      })
    ).resolves.toEqual({ kind: "invalid-link" });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("normalize 後に重複する URL は拒否する", async () => {
    stubLinks([row(0, "https://example.com/a")]);
    await expect(
      addNatoriProjectReferenceLink({
        projectId: PROJECT_ID,
        url: "https://EXAMPLE.com:443/a#other",
        label: null,
      })
    ).resolves.toEqual({ kind: "duplicate-link" });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("DB の unique 違反も duplicate として扱う", async () => {
    mockInsert.mockResolvedValue({ kind: "duplicate" });
    await expect(
      addNatoriProjectReferenceLink({
        projectId: PROJECT_ID,
        url: "https://example.com/a",
        label: null,
      })
    ).resolves.toEqual({ kind: "duplicate-link" });
  });

  it("6件目は上限エラーで、既存 link を触らない", async () => {
    stubLinks([0, 1, 2, 3, 4].map((i) => row(i, `https://example.com/${i}`)));
    await expect(
      addNatoriProjectReferenceLink({
        projectId: PROJECT_ID,
        url: "https://example.com/5",
        label: null,
      })
    ).resolves.toEqual({ kind: "link-limit-exceeded" });
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("label 上限超過は拒否する", async () => {
    await expect(
      addNatoriProjectReferenceLink({
        projectId: PROJECT_ID,
        url: "https://example.com/a",
        label: "あ".repeat(101),
      })
    ).resolves.toEqual({ kind: "invalid-link" });
  });
});

describe("update", () => {
  it("url と normalized_url を同一 UPDATE で書く", async () => {
    stubLinks([row(0, "https://example.com/a"), row(1, "https://example.com/b")]);
    await updateNatoriProjectReferenceLink({
      projectId: PROJECT_ID,
      linkId: "link-0",
      url: "https://example.com/c#frag",
      label: "更新",
    });
    expect(mockUpdate).toHaveBeenCalledWith(PROJECT_ID, "link-0", {
      url: "https://example.com/c#frag",
      normalized_url: "https://example.com/c",
      label: "更新",
    });
  });

  it("他の link と重複する URL への変更を拒否する", async () => {
    stubLinks([row(0, "https://example.com/a"), row(1, "https://example.com/b")]);
    await expect(
      updateNatoriProjectReferenceLink({
        projectId: PROJECT_ID,
        linkId: "link-0",
        url: "https://example.com/b",
        label: null,
      })
    ).resolves.toEqual({ kind: "duplicate-link" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("存在しない link は not-found", async () => {
    stubLinks([row(0, "https://example.com/a")]);
    await expect(
      updateNatoriProjectReferenceLink({
        projectId: PROJECT_ID,
        linkId: "missing",
        url: "https://example.com/z",
        label: null,
      })
    ).resolves.toEqual({ kind: "not-found" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("sort_order（追加時のみ決める）", () => {
  it("既存が空なら 0 を使う", async () => {
    stubLinks([]);
    await addNatoriProjectReferenceLink({
      projectId: PROJECT_ID,
      url: "https://example.com/a",
      label: null,
    });
    expect(mockInsert.mock.calls[0][0].sortOrder).toBe(0);
  });

  it("欠番があっても max(sort_order) + 1 を使う（件数は使わない）", async () => {
    // 0, 2, 5 の3件。件数 3 を使うと既存の途中へ割り込む。
    stubLinks([
      { ...row(0, "https://example.com/a"), sort_order: 0 },
      { ...row(1, "https://example.com/b"), sort_order: 2 },
      { ...row(2, "https://example.com/c"), sort_order: 5 },
    ]);
    await addNatoriProjectReferenceLink({
      projectId: PROJECT_ID,
      url: "https://example.com/d",
      label: null,
    });
    expect(mockInsert.mock.calls[0][0].sortOrder).toBe(6);
    expect(mockInsert.mock.calls[0][0].sortOrder).not.toBe(3);
  });

  it("追加操作で既存 link の sort_order を書き換えない", async () => {
    stubLinks([
      { ...row(0, "https://example.com/a"), sort_order: 0 },
      { ...row(1, "https://example.com/b"), sort_order: 5 },
    ]);
    await addNatoriProjectReferenceLink({
      projectId: PROJECT_ID,
      url: "https://example.com/c",
      label: null,
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("編集では sort_order を送らない", async () => {
    stubLinks([{ ...row(0, "https://example.com/a"), sort_order: 5 }]);
    await updateNatoriProjectReferenceLink({
      projectId: PROJECT_ID,
      linkId: "link-0",
      url: "https://example.com/b",
      label: null,
    });
    expect(mockUpdate.mock.calls[0][2]).not.toHaveProperty("sort_order");
  });
});

describe("delete", () => {
  it("単一 DELETE だけで完了し、残りの link を UPDATE しない", async () => {
    const remaining = [
      { ...row(1, "https://example.com/b"), sort_order: 1 },
      { ...row(2, "https://example.com/c"), sort_order: 2 },
    ];
    mockSelect.mockResolvedValue({ kind: "ok", value: remaining });

    const result = await deleteNatoriProjectReferenceLink(PROJECT_ID, "link-0");

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledWith(PROJECT_ID, "link-0");
    // 詰め直しをしないので sort_order の欠番はそのまま残る
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(result).toMatchObject({ kind: "ok" });
    if (result.kind !== "ok") return;
    expect(result.links.map((link) => link.sortOrder)).toEqual([1, 2]);
  });

  it("DELETE が失敗したら他 link への UPDATE を一切行わない", async () => {
    stubLinks([row(0, "https://example.com/a"), row(1, "https://example.com/b")]);
    mockDelete.mockResolvedValue({ kind: "db-error" });

    await expect(
      deleteNatoriProjectReferenceLink(PROJECT_ID, "link-0")
    ).resolves.toEqual({ kind: "db-error" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("存在しない link の削除は not-found で、UPDATE しない", async () => {
    mockDelete.mockResolvedValue({ kind: "not-found" });
    await expect(
      deleteNatoriProjectReferenceLink(PROJECT_ID, "missing")
    ).resolves.toEqual({ kind: "not-found" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("並び替えは P1-07 の範囲外", () => {
  it("reorder service を export しない", () => {
    expect(
      (referenceLinksService as Record<string, unknown>).reorderNatoriProjectReferenceLinks
    ).toBeUndefined();
    expect(
      Object.keys(referenceLinksService).some((key) =>
        key.toLowerCase().includes("reorder")
      )
    ).toBe(false);
  });

  it("どの操作でも delete all + insert all をしない", async () => {
    stubLinks([row(0, "https://example.com/a"), row(1, "https://example.com/b")]);
    await addNatoriProjectReferenceLink({
      projectId: PROJECT_ID,
      url: "https://example.com/c",
      label: null,
    });
    await updateNatoriProjectReferenceLink({
      projectId: PROJECT_ID,
      linkId: "link-0",
      url: "https://example.com/d",
      label: null,
    });
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });
});

describe("外部アクセスをしない", () => {
  it("いずれの操作でも fetch を呼ばない", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    stubLinks([row(0, "https://example.com/a")]);

    await listNatoriProjectReferenceLinks(PROJECT_ID);
    await addNatoriProjectReferenceLink({
      projectId: PROJECT_ID,
      url: "https://example.com/b",
      label: null,
    });
    await updateNatoriProjectReferenceLink({
      projectId: PROJECT_ID,
      linkId: "link-0",
      url: "https://example.com/c",
      label: null,
    });
    await deleteNatoriProjectReferenceLink(PROJECT_ID, "link-0");

    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("追加時の sort_order は正規化ではなく service が決める", () => {
  it("最終セット検証の戻り値に sortOrder を含めない", async () => {
    stubLinks([]);
    await addNatoriProjectReferenceLink({
      projectId: PROJECT_ID,
      url: "https://example.com/a",
      label: null,
    });
    // insert へ渡すのは service が計算した値のみ
    expect(Object.keys(mockInsert.mock.calls[0][0]).sort()).toEqual([
      "label",
      "normalizedUrl",
      "projectId",
      "sortOrder",
      "url",
    ]);
  });
});
