import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { canonicalIntakeJson, canonicalizeIntake } from "@/features/natori/lib/intakeOperation";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), settle: vi.fn(), submit: vi.fn(), rate: vi.fn(), availability: vi.fn(), enabled: vi.fn() }));
vi.mock("server-only", () => ({}));
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
const req = (body: object, headers = {}) => new Request("http://localhost/api/natori/portfolio/contact", { method: "POST", headers: { "Content-Type": "application/json", "x-requested-with": "me-ish", ...headers }, body: JSON.stringify(body) });
beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.lookup.mockResolvedValue({ kind: "not_found" }); mocks.submit.mockResolvedValue({ kind: "processing" });
  mocks.rate.mockResolvedValue({ allowed: true }); mocks.availability.mockResolvedValue({ kind: "ok", commissionOpen: true, massProductionIllustrationOpen: true }); mocks.enabled.mockReturnValue(true);
});
describe("admission guard with exact completed replay exemption",()=>{
 it("new request closes when availability is unavailable without losing unknown-operation fence",async()=>{
  mocks.availability.mockResolvedValue({kind:"unavailable"});const response=await POST(req({...fields,operationId,requestHash:hash}));expect(response.status).toBe(503);expect(mocks.submit).not.toHaveBeenCalled();
 });
 it("new globally closed request refuses project creation",async()=>{
  mocks.availability.mockResolvedValue({kind:"ok",commissionOpen:false,massProductionIllustrationOpen:false});expect((await POST(req({...fields,operationId,requestHash:hash}))).status).toBe(409);expect(mocks.submit).not.toHaveBeenCalled();
 });
 it.each([false,true])("legacy mass-production closure is enforced globallyOpen=%s",async commissionOpen=>{
  const mass={...fields,requestType:"量産イラスト"},requestHash=createHash("sha256").update(canonicalIntakeJson(canonicalizeIntake(mass,[]))).digest("hex");
  mocks.availability.mockResolvedValue({kind:"ok",commissionOpen,massProductionIllustrationOpen:false});expect((await POST(req({...mass,operationId,requestHash}))).status).toBe(409);expect(mocks.submit).not.toHaveBeenCalled();
 });
 it("completed exact operation bypasses closed admissions, disabled flag and normal quota",async()=>{
  mocks.availability.mockResolvedValue({kind:"ok",commissionOpen:false,massProductionIllustrationOpen:false});mocks.enabled.mockReturnValue(false);mocks.lookup.mockResolvedValue({kind:"completed",receipt:{ok:true,success:true,accepted:true,receipt:operationId,notificationDelivery:"pending"}});
  const response=await POST(req({...fields,operationId,requestHash:hash}));expect(response.status).toBe(200);expect((await response.json()).receipt).toBe(operationId);expect(mocks.availability).not.toHaveBeenCalled();expect(mocks.rate).toHaveBeenCalledTimes(1);expect(mocks.submit).not.toHaveBeenCalled();
 });
 it("reconciliation and failed settlement remain usable during closure",async()=>{
  mocks.availability.mockResolvedValue({kind:"unavailable"});mocks.lookup.mockResolvedValue({kind:"processing"});mocks.settle.mockResolvedValue({kind:"failed"});
  expect((await POST(req({action:"reconcile",operationId,requestHash:hash}))).status).toBe(202);
  const response=await POST(req({action:"settle",operationId,requestHash:hash}));expect(response.status).toBe(409);expect((await response.json()).operationState).toBe("failed");expect(mocks.availability).not.toHaveBeenCalled();expect(mocks.submit).not.toHaveBeenCalled();
 });
});
