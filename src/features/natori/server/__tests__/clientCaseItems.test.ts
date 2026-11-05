// お客さまの相談ページの品目：リンクで案件を確かめ、金額などは渡さない。
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  project: { id: "p1", deleted_at: null } as { id: string; deleted_at: string | null } | null,
  rows: [] as Record<string, unknown>[] | null,
  selected: "",
  filters: [] as [string, unknown][],
}));
vi.mock("../consultationService", () => ({ getClientProject: async () => state.project }));
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: () => ({
    from: () => {
      const b = {
        select: (columns: string) => { state.selected = columns; return b; },
        eq: (c: string, v: unknown) => { state.filters.push([c, v]); return b; },
        order: async () => (state.rows ? { data: state.rows, error: null } : { data: null, error: { message: "down" } }),
      };
      return b;
    },
  }),
}));
import { getClientCaseItems } from "../clientCaseItems";

beforeEach(() => { state.project = { id: "p1", deleted_at: null }; state.rows = []; state.filters = []; state.selected = ""; });

it("reads only the linked case's items and never asks for amounts", async () => {
  state.rows = [{ position: 1, title: "SD", progress: "done", due_date: "2026-12-01" }];
  expect(await getClientCaseItems("t".repeat(32))).toEqual([{ position: 1, title: "SD", progress: "done", dueDate: "2026-12-01" }]);
  expect(state.filters).toEqual([["project_id", "p1"]]);
  expect(state.selected).not.toMatch(/amount|note|publication/);
});

it("returns nothing for a bad link, a removed case, or a read error", async () => {
  state.project = null;
  expect(await getClientCaseItems("x")).toBeNull();
  state.project = { id: "p1", deleted_at: "2026-11-01T00:00:00Z" };
  expect(await getClientCaseItems("x")).toBeNull();
  state.project = { id: "p1", deleted_at: null }; state.rows = null;
  expect(await getClientCaseItems("x")).toBeNull();
});
