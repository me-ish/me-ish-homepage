import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ rpc: vi.fn(), owner: vi.fn(), releases: vi.fn(), projects: vi.fn(), projectFilters: [] as unknown[][] }));
vi.mock("../trustedNatoriOwner", () => ({ resolveTrustedNatoriOwnerId: m.owner }));
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: () => ({
    rpc: m.rpc,
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      for (const name of ["select", "is", "lt", "order", "eq", "in"]) {
        chain[name] = (...args: unknown[]) => {
          if (table === "natori_projects") m.projectFilters.push([name, ...args]);
          return chain;
        };
      }
      chain.limit = () => (table === "natori_delivery_releases" ? m.releases() : m.projects());
      return chain;
    },
  }),
}));

import { SCHEDULED_COMPLETION_NOTE, runScheduledNatoriDeemedCompletion } from "../scheduledCaseCompletion";

const OWNER = "22222222-2222-4222-8222-222222222222";
const A = "a0000000-0000-4000-8000-000000000001";
const B = "a0000000-0000-4000-8000-000000000002";

beforeEach(() => {
  vi.clearAllMocks();
  m.projectFilters.length = 0;
  m.owner.mockReturnValue({ kind: "ok", ownerId: OWNER });
  m.releases.mockResolvedValue({ data: [{ project_id: A }, { project_id: B }], error: null });
  m.projects.mockResolvedValue({ data: [{ id: A }, { id: B }], error: null });
  m.rpc.mockImplementation(async (name: string) =>
    name === "natori_case_work_revision_v1" ? { data: "r".repeat(64), error: null } : { data: { result: "applied" }, error: null });
});

describe("scheduled completion of expired, unaccepted deliveries", () => {
  it("does nothing without a configured owner", async () => {
    m.owner.mockReturnValue({ kind: "missing" });
    expect(await runScheduledNatoriDeemedCompletion()).toBeNull();
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("asks the fixed RPC with the schedule operator, and only for the owner's delivered cases", async () => {
    expect(await runScheduledNatoriDeemedCompletion()).toEqual({ checked: 2, applied: 2, skipped: 0, failed: 0 });
    expect(m.projectFilters).toEqual(expect.arrayContaining([["eq", "user_id", OWNER], ["eq", "status", "delivered"], ["in", "id", [A, B]]]));
    const calls = m.rpc.mock.calls.filter(([name]) => name === "natori_case_complete_v1");
    expect(calls).toHaveLength(2);
    expect(calls[0][1]).toMatchObject({
      p_owner: OWNER, p_project: A,
      p_input: { kind: "deemed", revision: "r".repeat(64), note: SCHEDULED_COMPLETION_NOTE, operator: { kind: "schedule" } },
    });
    expect(calls[0][1].p_input).not.toHaveProperty("completedAt");
  });

  it("counts a refusal as skipped and a broken call as failed", async () => {
    m.rpc.mockImplementation(async (name: string, args: { p_project: string }) => {
      if (name === "natori_case_work_revision_v1") return { data: "r".repeat(64), error: null };
      return args.p_project === A ? { data: { result: "not-expired" }, error: null } : { data: null, error: { message: "x" } };
    });
    expect(await runScheduledNatoriDeemedCompletion()).toEqual({ checked: 2, applied: 0, skipped: 1, failed: 1 });
  });

  it("stops quietly when nothing has expired", async () => {
    m.releases.mockResolvedValue({ data: [], error: null });
    expect(await runScheduledNatoriDeemedCompletion()).toEqual({ checked: 0, applied: 0, skipped: 0, failed: 0 });
    expect(m.rpc).not.toHaveBeenCalled();
  });
});
