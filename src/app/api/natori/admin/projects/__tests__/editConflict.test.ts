import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/features/natori/server/natoriManagementRoute", () => ({ withNatoriManagement: (_a: string, _b: boolean, handler: unknown) => handler }));
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), auth: vi.fn() }));
vi.mock("@/features/natori/server/requireNatoriAdmin", () => ({ canUseNatoriManagement: mocks.auth }));
vi.mock("@/features/natori/server/natoriOwner", () => ({ resolveNatoriOwnerId: async () => "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
vi.mock("@/features/natori/server/taskIntegrityService", () => ({ loadCoherentTaskSnapshot: vi.fn(), setTaskFromLatestDb: vi.fn() }));
vi.mock("@/features/natori/server/portfolioSiteService", () => ({ signPortfolioReferenceImage: vi.fn() }));
import { PATCH } from "../route";
import { PUT } from "../../profile/route";
import { updateNatoriProjectDetails } from "@/features/natori/data/supabaseProjects";
import { upsertOwnNatoriProfile } from "@/features/natori/data/supabaseProfile";
import { NatoriEditConflictError } from "@/features/natori/lib/editConflict";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", owner = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const headers = { "x-requested-with": "me-ish", "content-type": "application/json" };
const request = (body: unknown) => new Request("http://local.invalid/api/natori/admin/projects", { method: "PATCH", headers, body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue(true); });

describe("Q03 HTTP edit boundary", () => {
  it.each([undefined, null, -1, 1.5, "1", Number.MAX_SAFE_INTEGER + 1])("rejects project revision %s before any DB write", async expectedRevision => {
    expect((await PATCH(request({ kind: "project-details", projectId: id, expectedRevision, patch: { title: "Draft" } }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it("uses a dedicated edit 409 distinct from invalid type and returns no DB snapshot in errors", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { result: "edit_conflict", project: { secret: "never expose" } }, error: null }).mockResolvedValueOnce({ data: { result: "invalid_type" }, error: null });
    const response = await PATCH(request({ kind: "project-details", projectId: id, expectedRevision: 1, patch: { title: "Draft" } }));
    expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: "edit_conflict", code: "natori_edit_conflict" });
    const type = await PATCH(request({ kind: "project-details", projectId: id, expectedRevision: 1, patch: { type: "icon" } }));
    expect(type.status).toBe(409); expect(await type.json()).not.toHaveProperty("code");
  });
  it.each(["request_data", "status", "next_action", "paid_amount", "mutation_revision", "user_id"])("rejects immutable %s before RPC", async field => {
    expect((await PATCH(request({ kind: "project-details", projectId: id, expectedRevision: 1, patch: { [field]: "bad" } }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("keeps management auth and CSRF checks before edits", async () => {
    mocks.auth.mockResolvedValue(false);
    expect((await PATCH(request({ kind: "project-details", projectId: id, expectedRevision: 1, patch: { title: "Draft" } }))).status).toBe(401);
    mocks.auth.mockResolvedValue(true);
    expect((await PATCH(new Request("http://local.invalid/", { method: "PATCH", body: "{}" }))).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([{}, { expectedRevision: undefined }, { expectedRevision: -1 }, { expectedRevision: "0" }])("old/invalid profile writer fails closed: %j", async fields => {
    expect((await PUT(request({ ...fields, patch: { displayName: "Draft" } }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("profile null is create-only and sparse input never clears absent fields", async () => {
    const profile = { user_id: owner, mutation_revision: 0, display_name: "Draft", handle: null, portfolio_url: null, links_url: null, daily_capacity_hours: null };
    mocks.rpc.mockResolvedValueOnce({ data: { result: "applied", profile }, error: null }).mockResolvedValueOnce({ data: { result: "edit_conflict" }, error: null });
    const response = await PUT(request({ expectedRevision: null, patch: { displayName: "Draft" } }));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ profile });
    expect(mocks.rpc).toHaveBeenCalledWith("natori_edit_profile_v1", { p_owner: owner, p_expected_revision: null, p_patch: { display_name: "Draft" } });
    const conflict = await PUT(request({ expectedRevision: null, patch: { dailyCapacityHours: 6 } }));
    expect(conflict.status).toBe(409); expect(await conflict.json()).toEqual({ error: "edit_conflict", code: "natori_edit_conflict" });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("missing profile RPC never falls back to upsert", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42883" } });
    expect((await PUT(request({ expectedRevision: 0, patch: { dailyCapacityHours: 6 } }))).status).toBe(500);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

describe("Q03 clients do not retry uncertain writes", () => {
  it("classifies only the dedicated 409 as an edit conflict", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "natori_edit_conflict" }), { status: 409 }));
    vi.stubGlobal("fetch", fetcher);
    try {
      await expect(updateNatoriProjectDetails(id, { title: "Draft" }, 1)).rejects.toBeInstanceOf(NatoriEditConflictError);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ kind: "project-details", projectId: id, expectedRevision: 1, patch: { title: "Draft" } });
    } finally { vi.unstubAllGlobals(); }
  });
  it("network loss and missing revisions never cause automatic resubmission", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("offline")); vi.stubGlobal("fetch", fetcher);
    try {
      await expect(updateNatoriProjectDetails(id, { note: "Draft" }, 1)).rejects.toThrow(); expect(fetcher).toHaveBeenCalledTimes(1);
      await expect(updateNatoriProjectDetails(id, { note: "Draft" })).rejects.toThrow(); expect(fetcher).toHaveBeenCalledTimes(1);
      await expect(upsertOwnNatoriProfile({ displayName: "Draft" })).rejects.toThrow(); expect(fetcher).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });
});
