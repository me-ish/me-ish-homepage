// projectsService のステータス遷移まわりのテスト。
// setNatoriProjectStatus / confirmNatoriProjectPayment / closeNatoriProject が
// lib/statusTransitions の遷移表を通し、不許可の遷移を DB に書かないことを固定する。
import { beforeEach, describe, expect, it, vi } from "vitest";

/* ---------- Mocks ---------- */

vi.mock("server-only", () => ({}));

const { mockAdminFrom, mockRpc } = vi.hoisted(() => ({
  mockAdminFrom: vi.fn(),
  mockRpc: vi.fn(),
}));
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: vi.fn(() => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  })),
}));

vi.mock("@/features/natori/server/natoriOwner", () => ({
  resolveNatoriActingUserId: vi.fn().mockResolvedValue("owner-1"),
}));

vi.mock("@/features/natori/server/projectThumbsService", () => ({
  deleteNatoriProjectThumb: vi.fn(),
}));

vi.mock("@/features/natori/server/portfolioSiteService", () => ({
  signPortfolioReferenceImage: vi.fn(),
}));

import {
  closeNatoriProject,
  confirmNatoriProjectPayment,
  deleteNatoriAdminProject,
  listNatoriAdminProjects,
  normalizeProjectTasksForRead,
  restoreNatoriAdminProject,
  setNatoriProjectStatus,
} from "@/features/natori/server/projectsService";
import { deleteNatoriProjectThumb } from "@/features/natori/server/projectThumbsService";

/* ---------- Helpers ---------- */

type Result = { data: unknown; error: unknown };

function chainResult(result: Result, calls?: string[]) {
  const chain: unknown = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") return (resolve: (v: Result) => void) => resolve(result);
        if (prop === "single" || prop === "maybeSingle") {
          return vi.fn().mockResolvedValue(result);
        }
        return (...args: unknown[]) => {
          calls?.push(`${String(prop)}(${args.map((a) => JSON.stringify(a)).join(",")})`);
          return chain;
        };
      },
    }
  );
  return chain;
}

/**
 * natori_projects のモック。select は selectResults を順に返す（fetch → refetch）。
 * update payload と filter 呼び出しを記録する。
 */
function projectsTable(
  selectResults: Result[],
  options: { updateResult?: Result } = {}
) {
  const updates: Record<string, unknown>[] = [];
  const updateCalls: string[] = [];
  let selectIndex = 0;
  const api = {
    select: vi.fn(() => {
      const result = selectResults[Math.min(selectIndex, selectResults.length - 1)];
      selectIndex += 1;
      return chainResult(result);
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      updates.push(payload);
      return chainResult(
        options.updateResult ?? { data: { id: "proj-1" }, error: null },
        updateCalls
      );
    }),
  };
  mockAdminFrom.mockImplementation((table: string) => {
    if (table !== "natori_projects") throw new Error(`unexpected table: ${table}`);
    return api;
  });
  return { api, updates, updateCalls };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRpc.mockResolvedValue({ data: true, error: null });
  mockAdminFrom.mockImplementation((table: string) => {
    throw new Error(`unexpected table access: ${table}`);
  });
});

/* ---------- Tests ---------- */

describe("setNatoriProjectStatus", () => {
  it("許可された遷移は現在ステータスを条件に含めて更新する", async () => {
    const { updates, updateCalls } = projectsTable([
      { data: { id: "proj-1", status: "quoted" }, error: null },
    ]);

    const result = await setNatoriProjectStatus("proj-1", "awaiting_payment", "入金待ち");
    expect(result).toEqual({ kind: "ok" });
    expect(updates).toHaveLength(1);
    expect(updates[0].status).toBe("awaiting_payment");
    // 読み取り時の状態から変わっていたら書かない（レース対策）
    expect(updateCalls).toContain('eq("status","quoted")');
  });

  it("不許可の遷移（制作中 → 受注前の逆行）は DB に書かず invalid-transition", async () => {
    const { updates } = projectsTable([
      { data: { id: "proj-1", status: "lineart" }, error: null },
    ]);

    const result = await setNatoriProjectStatus("proj-1", "awaiting_payment", "");
    expect(result).toEqual({
      kind: "invalid-transition",
      from: "lineart",
      to: "awaiting_payment",
    });
    expect(updates).toHaveLength(0);
  });

  it("タスク駆動の制作工程の行き来（逆方向含む）は通す", async () => {
    const { updates } = projectsTable([
      { data: { id: "proj-1", status: "lineart" }, error: null },
    ]);

    const result = await setNatoriProjectStatus("proj-1", "rough", "ラフ作成");
    expect(result).toEqual({ kind: "ok" });
    expect(updates).toHaveLength(1);
  });

  it("案件が無ければ not-found", async () => {
    projectsTable([{ data: null, error: null }]);
    const result = await setNatoriProjectStatus("missing", "quoted", "");
    expect(result).toEqual({ kind: "not-found" });
  });
});

describe("confirmNatoriProjectPayment", () => {
  it("受注前の案件はDB関数で入金台帳と案件を原子的に更新する", async () => {
    projectsTable([{ data: { id: "proj-1", status: "awaiting_payment" }, error: null }]);

    const result = await confirmNatoriProjectPayment("proj-1", "ラフ作成");
    expect(result).toEqual({ kind: "ok" });
    expect(mockRpc).toHaveBeenCalledWith("natori_confirm_manual_payment", {
      p_user_id: "owner-1",
      p_project_id: "proj-1",
      p_next_action: "ラフ作成",
    });
  });

  it("既に制作中なら 0 行 → invalid-transition（巻き戻さない）", async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    projectsTable([{ data: { id: "proj-1", status: "coloring" }, error: null }]);

    const result = await confirmNatoriProjectPayment("proj-1", "ラフ作成");
    expect(result).toEqual({ kind: "invalid-transition", from: "coloring", to: "rough" });
  });

  it("案件が無ければ not-found", async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    projectsTable([{ data: null, error: null }]);
    const result = await confirmNatoriProjectPayment("missing", "ラフ作成");
    expect(result).toEqual({ kind: "not-found" });
  });
});

describe("closeNatoriProject", () => {
  it("受注前の案件は見送りにでき、理由をメモに残す", async () => {
    const { updates } = projectsTable([
      { data: { id: "proj-1", note: "既存メモ", status: "inquiry" }, error: null },
    ]);

    const result = await closeNatoriProject("proj-1", "予算が合わなかった");
    expect(result).toEqual({ kind: "ok" });
    expect(updates).toHaveLength(1);
    expect(updates[0].status).toBe("closed");
    expect(String(updates[0].note)).toContain("予算が合わなかった");
  });

  it("入金済みの制作中案件は見送りにできない", async () => {
    const { updates } = projectsTable([
      { data: { id: "proj-1", note: null, status: "rough" }, error: null },
    ]);

    const result = await closeNatoriProject("proj-1", "キャンセル");
    expect(result).toEqual({ kind: "invalid-transition", from: "rough", to: "closed" });
    expect(updates).toHaveLength(0);
  });
});

describe("project archive and restore", () => {
  it("deleteは行を消さずdeleted_atを記録する", async () => {
    const { updates, updateCalls } = projectsTable([]);

    const result = await deleteNatoriAdminProject("proj-1");

    expect(result).toEqual({ kind: "ok" });
    expect(updates).toHaveLength(1);
    expect(typeof updates[0].deleted_at).toBe("string");
    expect(updateCalls).toContain('eq("user_id","owner-1")');
    expect(updateCalls).toContain('is("deleted_at",null)');
    expect(deleteNatoriProjectThumb).not.toHaveBeenCalled();
  });

  it("同じ案件を再度archiveしても行やStorageを物理削除しない", async () => {
    const { updates } = projectsTable([], {
      updateResult: { data: null, error: null },
    });

    const result = await deleteNatoriAdminProject("proj-1");

    expect(result).toEqual({ kind: "not-found" });
    expect(updates).toHaveLength(1);
    expect(deleteNatoriProjectThumb).not.toHaveBeenCalled();
  });

  it("ownerが一致しない案件はarchiveできない", async () => {
    const { updateCalls } = projectsTable([], {
      updateResult: { data: null, error: null },
    });

    const result = await deleteNatoriAdminProject("project-of-another-owner");

    expect(result).toEqual({ kind: "not-found" });
    expect(updateCalls).toContain('eq("user_id","owner-1")');
    expect(deleteNatoriProjectThumb).not.toHaveBeenCalled();
  });

  it("restoreはdeleted_atをnullへ戻す", async () => {
    const { updates, updateCalls } = projectsTable([]);

    const result = await restoreNatoriAdminProject("proj-1");

    expect(result).toEqual({ kind: "ok" });
    expect(updates).toEqual([{ deleted_at: null }]);
    expect(updateCalls).toContain('eq("user_id","owner-1")');
    expect(updateCalls).toContain('not("deleted_at","is",null)');
  });
});

describe("listNatoriAdminProjects", () => {
  it("reads active/archive lanes without performing any database write", async () => {
    const calls: string[] = [];
    let projectQueryIndex = 0;
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "natori_projects") {
        const result =
          projectQueryIndex++ === 0
            ? {
                data: [
                  { id: "active-1", deleted_at: null },
                  // Application guard must reject this even if the query mock leaks it.
                  { id: "leaked-archive", deleted_at: "2026-07-01T00:00:00Z" },
                ],
                error: null,
              }
            : {
                data: [
                  { id: "archive-1", deleted_at: "2026-07-02T00:00:00Z" },
                  // Application guard must reject this from the archive lane.
                  { id: "leaked-active", deleted_at: null },
                ],
                error: null,
              };
        return chainResult(result, calls);
      }
      if (table === "natori_project_tasks") {
        return chainResult({ data: [], error: null }, calls);
      }
      if (table === "natori_inquiry_reference_files") {
        return chainResult({ data: [], error: null }, calls);
      }
      throw new Error(`unexpected table access: ${table}`);
    });

    const result = await listNatoriAdminProjects();

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("expected successful project list");
    expect(result.projects.map((project) => project.id)).toEqual(["active-1"]);
    expect(result.archivedProjects.map((project) => project.id)).toEqual([
      "archive-1",
    ]);
    expect(calls).toContain('is("deleted_at",null)');
    expect(calls).toContain('not("deleted_at","is",null)');
    expect(calls.some((call) => /^(update|upsert|delete|insert)\(/.test(call))).toBe(
      false
    );
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("normalizeProjectTasksForRead", () => {
  const baseProject = {
    id: "project-1",
    user_id: "owner-1",
    title: "案件",
    client_name: "依頼者",
    amount: null,
    type: "icon",
    status: "rough",
    delivery_plan: "normal",
    priority: null,
    start_date: null,
    due_date: null,
    created_at: "2026-07-27T00:00:00.000Z",
    next_action: "ラフ作成",
    note: null,
    deleted_at: null,
  };

  it("normalizes concrete-type tasks in memory without a database client", () => {
    const tasks = normalizeProjectTasksForRead([baseProject], []);
    expect(tasks).toHaveLength(6);
    expect(tasks[0]).toMatchObject({
      project_id: "project-1",
      task_key: "rough",
      sort_order: 0,
    });
  });

  it("does not generate a task template for an undecided type", () => {
    expect(
      normalizeProjectTasksForRead(
        [{ ...baseProject, type: "undecided" }],
        []
      )
    ).toEqual([]);
  });
});
