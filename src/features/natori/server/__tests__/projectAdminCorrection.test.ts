// P1-07 の管理補正まわり。
// request_data が全操作で不変であること、amount/due の3状態、archive/owner scope、
// 種別確定が RPC 経由で application から task を INSERT しないことを固定する。
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mockAdminFrom, mockResolveOwner, mockConfirmRpc, mockSign, mockBulkLinks } =
  vi.hoisted(() => ({
    mockAdminFrom: vi.fn(),
    mockResolveOwner: vi.fn(),
    mockConfirmRpc: vi.fn(),
    mockSign: vi.fn(),
    mockBulkLinks: vi.fn(),
  }));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: vi.fn(() => ({ from: (...args: unknown[]) => mockAdminFrom(...args) })),
}));

vi.mock("@/features/natori/server/natoriOwner", () => ({
  resolveNatoriActingUserId: (...args: unknown[]) => mockResolveOwner(...args),
}));

vi.mock("@/features/natori/server/intakeRpcAdapter", () => ({
  confirmNatoriProjectTypeViaRpc: (...args: unknown[]) => mockConfirmRpc(...args),
}));

vi.mock("@/features/natori/server/portfolioSiteService", () => ({
  signPortfolioReferenceImage: (...args: unknown[]) => mockSign(...args),
}));

vi.mock("@/features/natori/server/referenceLinkTableAdapter", () => ({
  selectReferenceLinksForProjects: (...args: unknown[]) => mockBulkLinks(...args),
}));

import {
  confirmNatoriProjectType,
  listNatoriAdminProjects,
  patchNatoriProjectDetails,
  referenceFileDisplayName,
  validateNatoriProjectDetailsValue,
} from "@/features/natori/server/projectsService";

const PROJECT_ID = "2ef91cb1-e0a3-4f32-b846-a0d8c6bbf44c";
const OWNER_ID = "a2823bd4-9b9a-4ae0-b408-e2d131c2ba09";

type Result = { data: unknown; error: unknown };

/** update payload を記録する natori_projects モック。 */
function projectsTable(options: {
  current?: Result;
  updateResult?: Result;
  updates: Record<string, unknown>[];
}) {
  const chain = (result: Result): unknown =>
    new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === "then") return (resolve: (v: Result) => void) => resolve(result);
          if (prop === "maybeSingle" || prop === "single") {
            return vi.fn().mockResolvedValue(result);
          }
          return () => chain(result);
        },
      }
    );

  return {
    select: () => chain(options.current ?? { data: null, error: null }),
    update: (payload: Record<string, unknown>) => {
      options.updates.push(payload);
      return chain(options.updateResult ?? { data: { id: PROJECT_ID }, error: null });
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveOwner.mockResolvedValue(OWNER_ID);
  mockSign.mockResolvedValue("https://signed.example.com/a.webp");
  mockBulkLinks.mockResolvedValue({ kind: "ok", value: [] });
});

describe("request_data immutability", () => {
  it.each([
    ["request_data", { request_data: { schemaVersion: 1 } }],
    ["id", { id: "other" }],
    ["user_id", { user_id: "other" }],
    ["status", { status: "rough" }],
    ["next_action", { next_action: "書き換え" }],
    ["deleted_at", { deleted_at: null }],
  ])("%s を含む patch は明示的に拒否し、DB へ書かない", async (field, patch) => {
    const updates: Record<string, unknown>[] = [];
    mockAdminFrom.mockReturnValue(projectsTable({ updates }));

    const result = await patchNatoriProjectDetails(PROJECT_ID, patch);

    expect(result).toEqual({ kind: "immutable-field", field });
    expect(updates).toHaveLength(0);
  });

  it("正常な補正では request_data を update payload に含めない", async () => {
    const updates: Record<string, unknown>[] = [];
    mockAdminFrom.mockReturnValue(projectsTable({ updates }));

    await patchNatoriProjectDetails(PROJECT_ID, {
      amount: 8000,
      due_date: "2026-09-01",
      delivery_plan: "normal",
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]).not.toHaveProperty("request_data");
    expect(updates[0]).not.toHaveProperty("note");
    expect(updates[0]).toEqual({
      amount: 8000,
      due_date: "2026-09-01",
      delivery_plan: "normal",
    });
  });

  it("種別確定は RPC のみを使い、project update も task INSERT も行わない", async () => {
    mockConfirmRpc.mockResolvedValue({
      kind: "confirmed",
      projectId: PROJECT_ID,
      projectType: "icon",
      taskCount: 6,
    });

    const result = await confirmNatoriProjectType(PROJECT_ID, "icon");

    expect(result).toEqual({
      kind: "ok",
      alreadyConfirmed: false,
      projectId: PROJECT_ID,
      projectType: "icon",
      taskCount: 6,
    });
    expect(mockConfirmRpc).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
      projectId: PROJECT_ID,
      projectType: "icon",
    });
    // application から natori_projects / natori_project_tasks を直接触らない
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });
});

describe("type confirm", () => {
  it("同じ種別の再送は already-confirmed で task を重複させない", async () => {
    mockConfirmRpc.mockResolvedValue({
      kind: "already-confirmed",
      projectId: PROJECT_ID,
      projectType: "icon",
      taskCount: 6,
    });
    const result = await confirmNatoriProjectType(PROJECT_ID, "icon");
    expect(result).toMatchObject({ kind: "ok", alreadyConfirmed: true, taskCount: 6 });
  });

  it.each([
    ["conflict", "conflict"],
    ["not-found", "not-found"],
    ["invalid-type", "invalid-type"],
    ["db-error", "db-error"],
  ])("RPC の %s を区別して返す", async (rpcKind, expected) => {
    mockConfirmRpc.mockResolvedValue({ kind: rpcKind });
    const result = await confirmNatoriProjectType(PROJECT_ID, "sd");
    expect(result.kind).toBe(expected);
  });

  it("owner が解決できなければ RPC を呼ばない", async () => {
    mockResolveOwner.mockResolvedValue(null);
    await expect(confirmNatoriProjectType(PROJECT_ID, "icon")).resolves.toEqual({
      kind: "not-found",
    });
    expect(mockConfirmRpc).not.toHaveBeenCalled();
  });
});

describe("amount / due date の値契約", () => {
  it.each([
    ["未確定", null, true],
    ["無料", 0, true],
    ["有料", 8000, true],
    ["負数", -1, false],
    ["小数", 1234.5, false],
    ["NaN", Number.NaN, false],
    ["safe integer 超過", Number.MAX_SAFE_INTEGER + 2, false],
    ["文字列", "8000", false],
  ])("amount %s -> %s", (_name, value, expected) => {
    expect(validateNatoriProjectDetailsValue("amount", value)).toBe(expected);
  });

  it.each([
    ["未確定", null, true],
    ["正常な日付", "2026-09-01", true],
    ["存在しない日付", "2026-02-30", false],
    ["月が不正", "2026-13-01", false],
    ["形式違い", "2026/09/01", false],
    ["空文字", "", false],
  ])("due_date %s -> %s", (_name, value, expected) => {
    expect(validateNatoriProjectDetailsValue("due_date", value)).toBe(expected);
  });

  it("timezone に関係なく同じ ISO 文字列を維持する", async () => {
    const updates: Record<string, unknown>[] = [];
    mockAdminFrom.mockReturnValue(projectsTable({ updates }));
    await patchNatoriProjectDetails(PROJECT_ID, { due_date: "2026-01-01" });
    expect(updates[0].due_date).toBe("2026-01-01");
  });

  it("不正な値は DB へ書かず invalid-value を返す", async () => {
    const updates: Record<string, unknown>[] = [];
    mockAdminFrom.mockReturnValue(projectsTable({ updates }));

    await expect(
      patchNatoriProjectDetails(PROJECT_ID, { amount: -5 })
    ).resolves.toEqual({ kind: "invalid-value", field: "amount" });
    await expect(
      patchNatoriProjectDetails(PROJECT_ID, { due_date: "2026-02-30" })
    ).resolves.toEqual({ kind: "invalid-value", field: "due_date" });
    await expect(
      patchNatoriProjectDetails(PROJECT_ID, { delivery_plan: "rush_1_day" })
    ).resolves.toEqual({ kind: "invalid-value", field: "delivery_plan" });
    expect(updates).toHaveLength(0);
  });

  it("amount null / 0 をそれぞれ保存できる", async () => {
    const updates: Record<string, unknown>[] = [];
    mockAdminFrom.mockReturnValue(projectsTable({ updates }));
    await patchNatoriProjectDetails(PROJECT_ID, { amount: null });
    await patchNatoriProjectDetails(PROJECT_ID, { amount: 0 });
    expect(updates).toEqual([{ amount: null }, { amount: 0 }]);
  });
});

describe("owner scope / archive", () => {
  it("owner が解決できなければ書き込まない", async () => {
    mockResolveOwner.mockResolvedValue(null);
    const updates: Record<string, unknown>[] = [];
    mockAdminFrom.mockReturnValue(projectsTable({ updates }));

    await expect(
      patchNatoriProjectDetails(PROJECT_ID, { amount: 100 })
    ).resolves.toEqual({ kind: "not-found" });
    expect(updates).toHaveLength(0);
  });

  it("archived / 他 owner の project は更新対象に一致せず not-found", async () => {
    const updates: Record<string, unknown>[] = [];
    mockAdminFrom.mockReturnValue(
      projectsTable({ updates, updateResult: { data: null, error: null } })
    );
    await expect(
      patchNatoriProjectDetails(PROJECT_ID, { amount: 100 })
    ).resolves.toEqual({ kind: "not-found" });
  });
});

describe("list / archive", () => {
  function listTables(rows: {
    active: unknown[];
    archived: unknown[];
    tasks?: unknown[];
    references?: unknown[];
  }) {
    const table = (result: Result): unknown =>
      new Proxy(
        {},
        {
          get(_, prop) {
            if (prop === "then") return (resolve: (v: Result) => void) => resolve(result);
            return () => table(result);
          },
        }
      );
    let projectCall = 0;
    return (name: string) => {
      if (name === "natori_projects") {
        projectCall += 1;
        return {
          select: () =>
            table({
              data: projectCall === 1 ? rows.active : rows.archived,
              error: null,
            }),
        };
      }
      if (name === "natori_project_tasks") {
        return { select: () => table({ data: rows.tasks ?? [], error: null }) };
      }
      return { select: () => table({ data: rows.references ?? [], error: null }) };
    };
  }

  const activeRow = {
    id: PROJECT_ID,
    user_id: OWNER_ID,
    title: "相談",
    client_name: "テスト",
    amount: null,
    type: "undecided",
    status: "inquiry",
    delivery_plan: "normal",
    priority: null,
    start_date: null,
    due_date: null,
    created_at: "2026-08-01T00:00:00.000Z",
    next_action: "相談内容を確認",
    note: null,
    deleted_at: null,
    request_data: { schemaVersion: 1 },
  };
  const archivedRow = { ...activeRow, id: "archived-1", deleted_at: "2026-08-02T00:00:00.000Z" };

  it("deleted_at ありは通常一覧から除外し、archived として分ける", async () => {
    mockAdminFrom.mockImplementation(
      listTables({ active: [activeRow], archived: [archivedRow] })
    );
    const result = await listNatoriAdminProjects();
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.projects.map((p) => p.id)).toEqual([PROJECT_ID]);
    expect(result.archivedProjects.map((p) => p.id)).toEqual(["archived-1"]);
  });

  it("structured 案件の request_data を一覧に載せる", async () => {
    mockAdminFrom.mockImplementation(listTables({ active: [activeRow], archived: [] }));
    const result = await listNatoriAdminProjects();
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.projects[0].request_data).toEqual({ schemaVersion: 1 });
  });

  it("legacy 案件（request_data なし）もそのまま返す", async () => {
    const legacy = { ...activeRow, request_data: null, note: "【ご依頼フォーム…】" };
    mockAdminFrom.mockImplementation(listTables({ active: [legacy], archived: [] }));
    const result = await listNatoriAdminProjects();
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.projects[0].request_data).toBeNull();
    expect(result.projects[0].note).toBe("【ご依頼フォーム…】");
  });

  it("参考画像は署名URLと安全な表示名を返し、Storage path を出さない", async () => {
    mockAdminFrom.mockImplementation(
      listTables({
        active: [activeRow],
        archived: [],
        references: [
          {
            project_id: PROJECT_ID,
            storage_path: `${PROJECT_ID}/b65e16de-13c8-4bf6-a830-87f466815dba.webp`,
          },
        ],
      })
    );
    const result = await listNatoriAdminProjects();
    if (result.kind !== "ok") throw new Error("expected ok");
    const file = result.referenceFiles[0];
    expect(file.url).toBe("https://signed.example.com/a.webp");
    expect(file.name).toBe("資料1（b65e16de）");
    expect(JSON.stringify(file)).not.toContain(".webp/");
    expect(file.name).not.toContain(PROJECT_ID);
  });

  it("署名に失敗した画像は一覧から外れるが、案件表示は続行する", async () => {
    mockSign.mockResolvedValue(null);
    mockAdminFrom.mockImplementation(
      listTables({
        active: [activeRow],
        archived: [],
        references: [{ project_id: PROJECT_ID, storage_path: `${PROJECT_ID}/a.webp` }],
      })
    );
    const result = await listNatoriAdminProjects();
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.referenceFiles).toEqual([]);
    expect(result.projects).toHaveLength(1);
  });

  it("link 取得に失敗しても案件一覧は返す", async () => {
    mockBulkLinks.mockResolvedValue({ kind: "db-error" });
    mockAdminFrom.mockImplementation(listTables({ active: [activeRow], archived: [] }));
    const result = await listNatoriAdminProjects();
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.referenceLinks).toEqual([]);
    expect(result.projects).toHaveLength(1);
  });
});

describe("referenceFileDisplayName", () => {
  it("Storage path を露出せず短い識別子だけを見せる", () => {
    const name = referenceFileDisplayName(
      `${PROJECT_ID}/b65e16de-13c8-4bf6-a830-87f466815dba.webp`,
      2
    );
    expect(name).toBe("資料3（b65e16de）");
    expect(name).not.toContain(PROJECT_ID);
    expect(name).not.toContain(".webp");
  });
});
