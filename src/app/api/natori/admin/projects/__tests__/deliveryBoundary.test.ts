import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// The authentication/owner wrapper is covered separately. Keep the real route
// and projects service here so a direct HTTP payload exercises the boundary.
vi.mock("@/features/natori/server/natoriManagementRoute", () => ({
  withNatoriManagement: (_operation: string, _mutation: boolean, handler: unknown) => handler,
}));
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), canUse: vi.fn(), owner: vi.fn(), task: vi.fn() }));
vi.mock("@/features/natori/server/requireNatoriAdmin", () => ({ canUseNatoriManagement: mocks.canUse }));
vi.mock("@/features/natori/server/natoriOwner", () => ({ resolveNatoriOwnerId: mocks.owner }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
vi.mock("@/features/natori/server/taskIntegrityService", () => ({
  loadCoherentTaskSnapshot: vi.fn(), setTaskFromLatestDb: mocks.task,
}));
vi.mock("@/features/natori/server/projectThumbsService", () => ({ deleteNatoriProjectThumb: vi.fn() }));
vi.mock("@/features/natori/server/portfolioSiteService", () => ({ signPortfolioReferenceImage: vi.fn() }));

import { PATCH, POST } from "../route";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const owner = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const paidAt = "2026-09-01T03:00:00Z";
const completedAt = "2026-09-15T03:00:00Z";
const headers = { "x-requested-with": "me-ish", "content-type": "application/json" };
const request = (body: unknown, method = "PATCH") => new Request("https://example.com/api/natori/admin/projects", {
  method, headers, body: JSON.stringify(body),
});
type Result = { data: unknown; error: unknown };

function query(result: Result, calls: string[]) {
  const chain: unknown = new Proxy({}, {
    get(_, prop) {
      if (prop === "then") return (resolve: (result: Result) => void) => resolve(result);
      if (prop === "maybeSingle") return () => Promise.resolve(result);
      return (...args: unknown[]) => {
        calls.push(`${String(prop)}:${JSON.stringify(args)}`);
        return chain;
      };
    },
  });
  return chain;
}

function installProject(status: string, failure?: "read" | "paid-read" | "write" | "cas" | "unpaid") {
  const row: Record<string, unknown> = {
    id, user_id: owner, type: "illustration", status, next_action: "original next action",
    paid_at: paidAt, paid_amount: 12000, payment_confirmed_at: paidAt, deleted_at: null,
    completed_at: status === "completed" ? completedAt : null,
    delivery_accepted_at: status === "completed" ? completedAt : null,
    delivery_token_hash: status === "rough" ? null : "synthetic-hash",
    delivered_mail_at: status === "rough" ? null : "2026-09-14T03:00:00Z",
  };
  const updates: Record<string, unknown>[] = [];
  const calls: string[] = [];
  let read = 0;
  mocks.from.mockImplementation((table: string) => {
    if (table !== "natori_projects") throw new Error(`Unexpected table ${table}`);
    return {
      select: () => {
        read += 1;
        const error = failure === "read" || (failure === "paid-read" && read === 2) ? { code: "synthetic-unavailable" } : null;
        return query({ data: error || (failure === "unpaid" && read === 2) ? null : { ...row }, error }, calls);
      },
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        const error = failure === "write" ? { code: "synthetic-unavailable" } : null;
        if (!error && failure !== "cas") Object.assign(row, patch);
        return query({ data: error || failure === "cas" ? null : { id }, error }, calls);
      },
    };
  });
  return { row, updates, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.canUse.mockResolvedValue(true);
  mocks.owner.mockResolvedValue(owner);
  mocks.rpc.mockResolvedValue({ data: id, error: null });
});

describe("direct generic status PATCH (PAY-01)", () => {
  it.each([
    ["delivery_prep", "delivered"], ["rough", "completed"], ["delivered", "completed"],
    ["delivered", "rough"], ["completed", "delivered"], ["completed", "rough"],
    ["delivered", "delivered"], ["completed", "completed"],
  ])("rejects %s → %s and leaves the entire row unchanged", async (from, to) => {
    const db = installProject(from);
    const before = structuredClone(db.row);
    const response = await PATCH(request({ kind: "project-status", projectId: id, status: to, nextAction: "bypass" }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: `Invalid status transition: ${from} -> ${to}` });
    expect(db.row).toEqual(before);
    expect(db.updates).toEqual([]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("allows ordinary paid work progress and undo without touching lifecycle dates", async () => {
    const db = installProject("rough");
    for (const status of ["lineart", "rough"]) {
      const response = await PATCH(request({ kind: "project-status", projectId: id, status, nextAction: "work" }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
      expect(db.row.status).toBe(status);
      expect(db.row.completed_at).toBeNull();
      expect(db.row.delivery_accepted_at).toBeNull();
    }
    expect(db.updates).toEqual([{ status: "lineart", next_action: "work" }, { status: "rough", next_action: "work" }]);
    expect(db.calls).toContain(`eq:${JSON.stringify(["user_id", owner])}`);
    expect(db.calls).toContain('eq:["status","rough"]');
    expect(db.calls).toContain('eq:["status","lineart"]');
  });

  it.each(["read", "paid-read", "write", "cas", "unpaid"] as const)(
    "does not claim success when ordinary progress encounters %s",
    async failure => {
      const db = installProject("rough", failure);
      const before = structuredClone(db.row);
      const response = await PATCH(request({ kind: "project-status", projectId: id, status: "lineart", nextAction: "work" }));
      expect(response.status).toBe(failure === "cas" || failure === "unpaid" ? 409 : 500);
      expect(await response.json()).not.toHaveProperty("ok");
      expect(db.row).toEqual(before);
    },
  );

  it.each(["delivered", "completed"])("permits metadata correction at %s without reopening or changing dates", async status => {
    const db = installProject(status);
    const before = structuredClone(db.row);
    const project = { id, mutationRevision: 2, clientName: "Synthetic", title: "Title", type: "illustration", amount: 12000, deliveryPlan: "normal", startDate: null, dueDate: null, note: "corrected note", nextAction: "original next action", status, clientEmail: null, priority: null, createdAt: "2026-10-17", requestData: null, tasks: [], paymentConfirmedAt: paidAt, paidAt, paidAmount: 12000, completedAt: status === "completed" ? completedAt : null, deliveryAcceptedAt: null, deliveredMailAt: null, deletedAt: null };
    mocks.rpc.mockResolvedValue({ data: { result: "applied", project }, error: null });
    const response = await PATCH(request({ kind: "project-details", projectId: id, expectedRevision: 1, patch: { note: "corrected note" } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, project });
    expect(db.row).toEqual(before);
    expect(db.updates).toEqual([]);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("natori_edit_project_v1", expect.objectContaining({ p_expected_revision: 1, p_patch: { note: "corrected note" } }));
  });

  it("does not let an old task payload supply a completion status", async () => {
    const db = installProject("delivered");
    const before = structuredClone(db.row);
    mocks.task.mockResolvedValue({ kind: "db-error" });
    const response = await PATCH(request({ kind: "task", projectId: id, taskKey: "delivery", done: true,
      status: "completed", nextAction: "bypass" }));
    expect(response.status).toBe(503);
    expect(mocks.task).toHaveBeenCalledExactlyOnceWith(id, "delivery", true);
    expect(db.row).toEqual(before);
    expect(db.updates).toEqual([]);
  });
});

describe("historical manually completed creation compatibility", () => {
  it("rejects a manually delivered project before the creation RPC", async () => {
    const response = await POST(request({ title: "Synthetic", clientName: "Synthetic client", amount: 12000,
      type: "illustration", status: "delivered", dueDateISO: "2026-09-15" }, "POST"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid initial status" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("resolves the owned project and preserves paid/completed dates without inventing acceptance", async () => {
    const response = await POST(request({ title: "Synthetic historical result", clientName: "Synthetic client", amount: 12000,
      type: "illustration", status: "completed", dueDateISO: "2026-09-15", startDateISO: "2026-09-01",
      userId: "untrusted-owner", deliveryAcceptedAt: "untrusted-acceptance" }, "POST"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ projectId: id });
    expect(mocks.rpc).toHaveBeenCalledWith("natori_create_project_with_tasks", expect.objectContaining({
      p_user_id: owner, p_project: expect.objectContaining({ status: "completed", paid_amount: 12000,
        payment_confirmed_at: "2026-09-15T12:00:00+09:00", paid_at: "2026-09-15T12:00:00+09:00",
        completed_at: "2026-09-15T12:00:00+09:00" }),
    }));
    const payload = mocks.rpc.mock.calls[0][1].p_project;
    expect(payload).not.toHaveProperty("delivery_accepted_at");
    expect(payload).not.toHaveProperty("delivery_token_hash");
    expect(payload).not.toHaveProperty("delivered_mail_at");
  });
});
