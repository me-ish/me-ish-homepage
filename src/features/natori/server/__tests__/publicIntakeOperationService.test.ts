import { beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalizeIntake } from "../../lib/intakeOperation";
import { buildNatoriRequestDataV1, createInitialPortfolioRequestFormState } from "../../lib/portfolioRequestForm";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), prepare: vi.fn(), remove: vi.fn(), schedule: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ rpc: mocks.rpc, storage: { from: () => ({ remove: mocks.remove }) } }) }));
vi.mock("../publicIntakeOwner", () => ({ resolvePublicIntakeOwnerId: () => ({ kind: "ok", ownerId: "d1a855ca-9478-4a8d-baa1-123456789abc" }) }));
vi.mock("../intakeReferenceStorage", () => ({ prepareIntakeReferenceImage: mocks.prepare, uploadIntakeReferenceImage: mocks.upload }));
vi.mock("../scheduleAcceptanceNotifications", () => ({ scheduleAcceptanceNotifications: mocks.schedule }));
import { hashCanonicalIntake, intakeReferenceFileId, settlePublicIntakeOperation, submitPublicIntakeOperation } from "../publicIntakeOperationService";

const operationId = "c1a855ca-9478-4a8d-baa1-123456789abc", projectId = "b1a855ca-9478-4a8d-baa1-123456789abc";
const receipt = { ok: true, success: true, accepted: true, receipt: operationId, notificationDelivery: "pending" };
const row = (result: string, extras = {}) => ({ result, replay_result: result === "completed" ? receipt : null, project_id: projectId, reference_paths: [], notification_ids: result === "completed" ? ["a1a855ca-9478-4a8d-baa1-123456789abc", "e1a855ca-9478-4a8d-baa1-123456789abc"] : [], ...extras });
const canonical = () => canonicalizeIntake({ name: "Synthetic", email: "client@example.invalid", formVersion: "etorie-request-v1", requestData: JSON.stringify(buildNatoriRequestDataV1({ ...createInitialPortfolioRequestFormState(), message: "Drawing" }, [])), referenceLinks: "[]" }, []);
beforeEach(() => { for (const mock of Object.values(mocks)) mock.mockReset(); mocks.prepare.mockResolvedValue({ kind: "ok", webp: Buffer.from("webp") }); mocks.upload.mockResolvedValue({ kind: "ok" }); });

describe("public intake operation boundaries", () => {
  it("recovers a lost finish response from the ledger without resending notifications or allocating a second project", async () => {
    let committed = false;
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "natori_intake_lookup_v1") return { data: [row(committed ? "completed" : "not_found")], error: null };
      if (name === "natori_intake_begin_v1") return { data: [row("claimed")], error: null };
      if (name === "natori_intake_touch_v1") return { data: true, error: null };
      if (name === "natori_intake_finish_v1") { committed = true; return { data: null, error: { code: "response_lost" } }; }
      throw new Error("unexpected_rpc");
    });
    expect(await submitPublicIntakeOperation(operationId, canonical(), [])).toEqual({ kind: "completed", receipt });
    expect(await submitPublicIntakeOperation(operationId, canonical(), [])).toEqual({ kind: "completed", receipt });
    expect(mocks.rpc.mock.calls.filter(([name]) => name === "natori_intake_finish_v1")).toHaveLength(1);
    expect(mocks.schedule).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.rpc.mock.calls.every(([, input]) => input.p_owner_id === "d1a855ca-9478-4a8d-baa1-123456789abc")).toBe(true);
  });
  it("retains unknown uploaded bytes instead of deleting objects that might later commit", async () => {
    const image = new File(["raw"], "ref.png", { type: "image/png" }), input = canonical();
    input.manifest = [{ digest: "a".repeat(64), size: image.size, type: "image/png" }];
    const path = `${projectId}/${intakeReferenceFileId(operationId, 0, input.manifest[0].digest)}.webp`;
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "natori_intake_lookup_v1" ? [row("not_found")] : name === "natori_intake_begin_v1" ? [row("claimed", { reference_paths: [path] })] : true, error: null }));
    mocks.upload.mockResolvedValue({ kind: "unknown" });
    expect((await submitPublicIntakeOperation(operationId, input, [image])).kind).toBe("unavailable");
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.rpc.mock.calls.some(([name]) => name === "natori_intake_finish_v1")).toBe(false);
  });
  it("fences a stale lease before finish and preserves evidence", async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "natori_intake_lookup_v1" ? [row("processing")] : name === "natori_intake_begin_v1" ? [row("claimed")] : false, error: null }));
    expect((await submitPublicIntakeOperation(operationId, canonical(), [])).kind).toBe("processing");
    expect(mocks.rpc.mock.calls.some(([name]) => name === "natori_intake_finish_v1")).toBe(false);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("refuses malformed server path envelopes before upload and invokes exact cleanup only after fenced failed settlement", async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "natori_intake_lookup_v1" ? [row("not_found")] : [row("claimed", { reference_paths: ["another-project/another-file.webp"] })], error: null }));
    expect((await submitPublicIntakeOperation(operationId, canonical(), [])).kind).toBe("unavailable"); expect(mocks.upload).not.toHaveBeenCalled();
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "natori_intake_settle_v1" ? [row("failed")] : [], error: null }));
    expect((await settlePublicIntakeOperation(operationId, hashCanonicalIntake(canonical()))).kind).toBe("failed");
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
