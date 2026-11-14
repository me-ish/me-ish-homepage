// 匿名化の呼び出し：ファイルを消してから印を入れる、消せなければ印を入れない、毎日の処理の対象の選び方。
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  rpc: [] as { name: string; args: Record<string, unknown> }[],
  rpcResult: {} as Record<string, unknown>,
  removed: [] as { bucket: string; paths: string[] }[],
  removeError: null as unknown,
  updates: [] as { table: string; payload: unknown; filters: [string, string, unknown][] }[],
  tables: {} as Record<string, unknown[]>,
  orFilters: [] as string[],
}));

vi.mock("@/features/natori/server/natoriOwner", () => ({
  resolveNatoriOwnerId: async () => "owner",
  resolveNatoriManagementContext: async () => ({ ownerId: "owner", operator: { kind: "auth-user", userId: "u" } }),
}));
vi.mock("@/features/natori/server/trustedNatoriOwner", () => ({ resolveTrustedNatoriOwnerId: () => ({ kind: "ok", ownerId: "owner" }) }));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.rpc.push({ name, args });
      return { data: state.rpcResult[String(args.p_project)] ?? { result: "not-found" }, error: null };
    },
    storage: { from: (bucket: string) => ({ remove: async (paths: string[]) => { state.removed.push({ bucket, paths }); return { error: state.removeError }; } }) },
    from: (table: string) => {
      const filters: [string, string, unknown][] = [];
      let payload: unknown;
      const b: Record<string, unknown> = {
        select: () => b, order: () => b, limit: () => b,
        eq: (c: string, v: unknown) => { filters.push(["eq", c, v]); return b; },
        is: (c: string, v: unknown) => { filters.push(["is", c, v]); return b; },
        in: (c: string, v: unknown) => { filters.push(["in", c, v]); return b; },
        or: (v: string) => { state.orFilters.push(v); return b; },
        update: (v: unknown) => { payload = v; return b; },
        maybeSingle: async () => ({ data: (state.tables[table] ?? [])[0] ?? null, error: null }),
        then: (res: (v: unknown) => void) => {
          if (payload !== undefined) { state.updates.push({ table, payload, filters }); res({ data: null, error: null }); }
          else res({ data: state.tables[table] ?? [], error: null });
        },
      };
      return b;
    },
  }),
}));

import { anonymizeNatoriCaseNow, runScheduledNatoriAnonymization } from "../caseAnonymizationService";

const files = [{ bucket: "natori-consultations", path: "p/a.png" }, { bucket: "natori-deliveries", path: "p/f.png" }];

beforeEach(() => {
  state.rpc = []; state.rpcResult = {}; state.removed = []; state.removeError = null; state.updates = []; state.tables = {}; state.orFilters = [];
});

describe("caseAnonymizationService", () => {
  it("anonymizes, removes the listed files, then marks them removed", async () => {
    state.rpcResult.p = { result: "applied", label: "依頼者 #00000000", storage: files, storagePurged: false };
    const outcome = await anonymizeNatoriCaseNow("p");
    expect(outcome).toEqual({ kind: "applied", label: "依頼者 #00000000", filesRemoved: true });
    expect(state.rpc[0].args).toMatchObject({ p_owner: "owner", p_project: "p", p_input: { kind: "manual", operator: { kind: "auth-user" } } });
    expect(state.removed.map((r) => r.bucket)).toEqual(["natori-consultations", "natori-deliveries"]);
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0].table).toBe("natori_case_anonymizations");
  });

  it("does not mark files removed when the storage call fails", async () => {
    state.rpcResult.p = { result: "applied", label: "依頼者 #00000000", storage: files, storagePurged: false };
    state.removeError = { message: "x" };
    expect(await anonymizeNatoriCaseNow("p")).toMatchObject({ kind: "applied", filesRemoved: false });
    expect(state.updates).toHaveLength(0);
  });

  it("passes refusals through without touching files", async () => {
    state.rpcResult.p = { result: "not-eligible" };
    expect(await anonymizeNatoriCaseNow("p")).toEqual({ kind: "not-eligible" });
    expect(state.removed).toHaveLength(0);
  });

  it("daily run uses the schedule operator and skips cases already done", async () => {
    state.tables.natori_case_anonymizations = [{ project_id: "done" }];
    state.tables.natori_projects = [{ id: "done" }, { id: "old" }];
    state.rpcResult.old = { result: "applied", label: "依頼者 #11111111", storage: [], storagePurged: false };
    const report = await runScheduledNatoriAnonymization();
    expect(state.rpc.map((r) => r.args.p_project)).toEqual(["old"]);
    expect(state.rpc[0].args.p_input).toEqual({ kind: "scheduled", operator: { kind: "schedule" } });
    expect(report).toMatchObject({ checked: 1, applied: 1, failed: 0 });
    expect(state.orFilters[0]).toMatch(/^completed_at\.lt\..+,and\(completed_at\.is\.null,updated_at\.lt\..+\)$/);
  });
});
