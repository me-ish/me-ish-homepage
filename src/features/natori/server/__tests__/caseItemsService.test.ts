// 案件の品目：所有者の確認、しまった案件への書き込み拒否、上限、同時編集の衝突を固定する。
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  owner: "owner" as string | null,
  project: { id: "p", deleted_at: null } as { id: string; deleted_at: string | null } | null,
  items: [] as Record<string, unknown>[],
  insertError: null as { code?: string } | null,
  changed: [{ id: "i" }] as { id: string }[],
  writes: [] as { table: string; op: string; payload?: unknown; filters: [string, unknown][] }[],
}));

vi.mock("@/features/natori/server/natoriOwner", () => ({
  resolveNatoriOwnerId: async () => state.owner,
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      const filters: [string, unknown][] = [];
      let op = "select";
      let payload: unknown;
      const builder = {
        select: () => builder,
        insert: (value: unknown) => { op = "insert"; payload = value; state.writes.push({ table, op, payload, filters }); return Promise.resolve({ error: state.insertError }); },
        update: (value: unknown) => { op = "update"; payload = value; return builder; },
        delete: () => { op = "delete"; return builder; },
        eq: (column: string, value: unknown) => { filters.push([column, value]); return builder; },
        order: () => Promise.resolve({ data: state.items, error: null }),
        maybeSingle: () => Promise.resolve({ data: filters.some(([c, v]) => c === "user_id" && v === state.owner) ? state.project : null, error: null }),
        then: (resolve: (value: unknown) => void) => {
          state.writes.push({ table, op, payload, filters });
          resolve({ data: state.changed, error: null });
        },
      };
      return builder;
    },
  }),
}));

import { addNatoriCaseItem, countNatoriCaseItemsByProject, deleteNatoriCaseItem, listNatoriCaseItems, updateNatoriCaseItem } from "../caseItemsService";

const fields = {
  title: "SD", projectType: "sd" as const, amount: 5000, dueDate: null, progress: "not_started" as const,
  publicationPolicy: "unknown" as const, publicationAllowedFrom: null, note: null, handedOverAt: null,
};
const row = (position: number) => ({
  id: `i${position}`, project_id: "p", position, title: `品目${position}`, project_type: "poster", amount: null, due_date: null,
  progress: "not_started", publication_policy: "unknown", publication_allowed_from: null, note: null, handed_over_at: null, updated_at: "t",
});

beforeEach(() => {
  state.owner = "owner"; state.project = { id: "p", deleted_at: null }; state.items = []; state.insertError = null;
  state.changed = [{ id: "i" }]; state.writes = [];
});

describe("caseItemsService", () => {
  it("lists items and drops an unknown stored type", async () => {
    state.items = [row(1)];
    const result = await listNatoriCaseItems("p");
    expect(result).toMatchObject({ kind: "ok", items: [{ id: "i1", position: 1, projectType: null }] });
  });
  it("hides another owner's case", async () => {
    state.owner = "someone-else"; state.project = null;
    expect(await listNatoriCaseItems("p")).toEqual({ kind: "not-found" });
  });
  it("refuses writes to an archived case but still lists it", async () => {
    state.project = { id: "p", deleted_at: "2026-11-01" };
    expect(await addNatoriCaseItem("p", fields)).toEqual({ kind: "project-archived" });
    expect((await listNatoriCaseItems("p")).kind).toBe("ok");
    expect(state.writes).toEqual([]);
  });
  it("appends after the last position and stops at 20", async () => {
    state.items = [row(1), row(4)];
    await addNatoriCaseItem("p", fields);
    expect(state.writes[0]).toMatchObject({ table: "natori_case_items", op: "insert", payload: { project_id: "p", position: 5, title: "SD", project_type: "sd" } });
    state.items = [row(20)];
    expect(await addNatoriCaseItem("p", fields)).toEqual({ kind: "item-limit-exceeded" });
  });
  it("reports a simultaneous add as a conflict", async () => {
    state.insertError = { code: "23505" };
    expect(await addNatoriCaseItem("p", fields)).toEqual({ kind: "conflict" });
  });
  it("updates and deletes only the row read at the same moment", async () => {
    await updateNatoriCaseItem("p", "i1", "t", fields);
    expect(state.writes[0].filters).toEqual([["id", "i1"], ["project_id", "p"], ["updated_at", "t"]]);
    state.changed = [];
    expect(await updateNatoriCaseItem("p", "i1", "old", fields)).toEqual({ kind: "conflict" });
    expect(await deleteNatoriCaseItem("p", "i1", "old")).toEqual({ kind: "conflict" });
  });
});

describe("countNatoriCaseItemsByProject", () => {
  it("counts items per case for the owner only", async () => {
    state.changed = [{ project_id: "p" }, { project_id: "p" }, { project_id: "q" }] as unknown as { id: string }[];
    expect(await countNatoriCaseItemsByProject()).toEqual({ p: 2, q: 1 });
    expect(state.writes.at(-1)?.filters).toEqual([["natori_projects.user_id", "owner"]]);
  });
  it("returns nothing without an owner", async () => {
    state.owner = null;
    expect(await countNatoriCaseItemsByProject()).toBeNull();
  });
});
