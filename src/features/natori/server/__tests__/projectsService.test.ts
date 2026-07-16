// projectsService のステータス遷移まわりのテスト。
// setNatoriProjectStatus / confirmNatoriProjectPayment / closeNatoriProject が
// lib/statusTransitions の遷移表を通し、不許可の遷移を DB に書かないことを固定する。
import { beforeEach, describe, expect, it, vi } from "vitest";

/* ---------- Mocks ---------- */

vi.mock("server-only", () => ({}));

const mockAdminFrom = vi.fn();
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: vi.fn(() => ({ from: (...args: unknown[]) => mockAdminFrom(...args) })),
}));

vi.mock("@/features/natori/server/projectThumbsService", () => ({
  deleteNatoriProjectThumb: vi.fn(),
}));

import {
  closeNatoriProject,
  confirmNatoriProjectPayment,
  setNatoriProjectStatus,
} from "@/features/natori/server/projectsService";

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
  it("受注前の案件は原子的な条件付き UPDATE で rough に進める", async () => {
    const { updates, updateCalls } = projectsTable([
      { data: { id: "proj-1", status: "awaiting_payment" }, error: null },
    ]);

    const result = await confirmNatoriProjectPayment("proj-1", "ラフ作成");
    expect(result).toEqual({ kind: "ok" });
    expect(updates).toHaveLength(1);
    expect(updates[0].status).toBe("rough");
    expect(updates[0].payment_confirmed_at).toBeTruthy();
    // 受注前ステータスだけを対象にする条件が付いている
    expect(updateCalls.some((call) => call.startsWith("in("))).toBe(true);
  });

  it("既に制作中なら 0 行 → invalid-transition（巻き戻さない）", async () => {
    projectsTable(
      [{ data: { id: "proj-1", status: "coloring" }, error: null }],
      { updateResult: { data: null, error: null } }
    );

    const result = await confirmNatoriProjectPayment("proj-1", "ラフ作成");
    expect(result).toEqual({ kind: "invalid-transition", from: "coloring", to: "rough" });
  });

  it("案件が無ければ not-found", async () => {
    projectsTable([{ data: null, error: null }], {
      updateResult: { data: null, error: null },
    });
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
