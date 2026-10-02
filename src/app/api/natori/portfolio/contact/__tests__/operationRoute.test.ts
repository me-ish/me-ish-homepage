import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { canonicalIntakeJson, canonicalizeIntake } from "@/features/natori/lib/intakeOperation";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), settle: vi.fn(), submit: vi.fn(), rate: vi.fn(), availability: vi.fn(), enabled: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/csrf", () => ({ checkCsrf: () => null }));
vi.mock("@/lib/auth/origin", () => ({ checkSameOrigin: () => null }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: mocks.rate, getIpFromRequest: () => "synthetic", rateLimitExceeded: () => new Response("{}", { status: 429 }) }));
vi.mock("@/features/natori/server/publicIntakeMetrics", () => ({ recordPublicIntakeMetric: () => {} }));
vi.mock("@/features/natori/server/publicCommissionAvailability", () => ({ loadPublicCommissionAvailability: mocks.availability }));
vi.mock("@/features/natori/server/publicIntakeRollout", () => ({ isPublicStructuredIntakeEnabled: mocks.enabled }));
vi.mock("@/features/natori/server/publicIntakeOperationService", () => ({ lookupPublicIntakeOperation: mocks.lookup, settlePublicIntakeOperation: mocks.settle, submitPublicIntakeOperation: mocks.submit,
  hashCanonicalIntake: (input: unknown) => createHash("sha256").update(canonicalIntakeJson(input)).digest("hex") }));
import { POST } from "../route";
const operationId = "c1a855ca-9478-4a8d-baa1-123456789abc";
const fields = { name: "Legacy", email: "client@example.invalid", requestType: "以前の種類", details: "Original full legacy detail" };
const hash = createHash("sha256").update(canonicalIntakeJson(canonicalizeIntake(fields, []))).digest("hex");
const req = (body: object, headers = {}) => new Request("http://localhost/api/natori/portfolio/contact", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.lookup.mockResolvedValue({ kind: "not_found" }); mocks.submit.mockResolvedValue({ kind: "processing" });
  mocks.rate.mockResolvedValue({ allowed: true }); mocks.availability.mockResolvedValue({ kind: "ok", commissionOpen: true, massProductionIllustrationOpen: true }); mocks.enabled.mockReturnValue(true);
});
describe("one public intake writer", () => {
  it("rejects no-ID old clients before any lookup/upload/DB/mail side effect", async () => {
    expect((await POST(req(fields))).status).toBe(409);
    expect(mocks.lookup).not.toHaveBeenCalled(); expect(mocks.submit).not.toHaveBeenCalled(); expect(mocks.availability).not.toHaveBeenCalled();
  });
  it("routes verified legacy JSON into the same canonical service with lossless legacySource", async () => {
    expect((await POST(req({ ...fields, operationId, requestHash: hash, refImages: ["https://evil.example/image.png"], ownerId: "attacker" }))).status).toBe(202);
    expect(mocks.submit.mock.calls[0][1].submission.requestData.legacySource.details).toBe(fields.details);
    expect(mocks.submit.mock.calls[0][2]).toEqual([]);
  });
  it("replays a completed operation before closed admission/flag/quota and exposes no project/PII", async () => {
    mocks.availability.mockResolvedValue({ kind: "ok", commissionOpen: false, massProductionIllustrationOpen: false }); mocks.enabled.mockReturnValue(false);
    mocks.lookup.mockResolvedValue({ kind: "completed", receipt: { ok: true, success: true, accepted: true, receipt: operationId, notificationDelivery: "pending" } });
    const result = await POST(req({ ...fields, operationId, requestHash: hash }));
    expect(result.status).toBe(200); expect(mocks.rate).toHaveBeenCalledTimes(1); expect(mocks.availability).not.toHaveBeenCalled();
    const body = await result.json(); expect(Object.keys(body).sort()).toEqual(["accepted", "notificationDelivery", "ok", "operationState", "receipt", "success"]);
    expect(JSON.stringify(body)).not.toContain(fields.email); expect(mocks.submit).not.toHaveBeenCalled();
  });
  it("does not consume normal new-intake quota during pending replay but abuse-limits reconciliation", async () => {
    mocks.lookup.mockResolvedValue({ kind: "processing" });
    await POST(req({ ...fields, operationId, requestHash: hash }));
    expect(mocks.rate).toHaveBeenCalledTimes(1); expect(mocks.rate.mock.calls[0][1].limit).toBe(60);
    mocks.rate.mockResolvedValue({ allowed: false }); expect((await POST(req({ action: "reconcile", operationId, requestHash: hash }))).status).toBe(429);
  });
  it("rejects changed request hash before lookup, bad length and actual oversized chunked body", async () => {
    expect((await POST(req({ ...fields, operationId, requestHash: "b".repeat(64) }))).status).toBe(409); expect(mocks.lookup).not.toHaveBeenCalled();
    expect((await POST(req({}, { "content-length": "-1" }))).status).toBe(400);
    const large = new Request("http://localhost/api/natori/portfolio/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: " ".repeat(4_400_001) });
    expect((await POST(large)).status).toBe(413);
  });
});
