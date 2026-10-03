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
describe("legacy operation validation and public request security", () => {
 it("enforces actual CSRF and origin guards before parsing and ledger access",async()=>{
  expect((await POST(req(fields,{"x-requested-with":"wrong"}))).status).toBe(403);
  expect((await POST(req(fields,{origin:"https://attacker.invalid"}))).status).toBe(403);
  expect(mocks.lookup).not.toHaveBeenCalled();expect(mocks.submit).not.toHaveBeenCalled();
 });
 it("old no-ID clients get explicit update guidance without silent mail-only success",async()=>{
  const response=await POST(req(fields));expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ok:false,error:"client_update_required"});
  expect(mocks.submit).not.toHaveBeenCalled();expect(mocks.lookup).not.toHaveBeenCalled();
 });
 it("honeypot does not allocate an operation or expose accepted receipt",async()=>{
  const response=await POST(req({...fields,operationId,requestHash:hash,website:"spam"}));expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({accepted:false});expect(mocks.submit).not.toHaveBeenCalled();expect(mocks.lookup).not.toHaveBeenCalled();
 });
 it.each(["name","email","requestType","details"])("rejects invalid required legacy %s before any ledger side effect",async key=>{
  expect((await POST(req({...fields,[key]:"",operationId,requestHash:hash}))).status).toBe(400);expect(mocks.lookup).not.toHaveBeenCalled();expect(mocks.submit).not.toHaveBeenCalled();
 });
 it("rejects duplicate multipart fields and unexpected upload keys",async()=>{
  const form=new FormData();for(const[k,v]of Object.entries(fields))form.set(k,v);form.set("operationId",operationId);form.set("requestHash",hash);form.append("name","Second name");
  expect((await POST(new Request("http://localhost/api/natori/portfolio/contact",{method:"POST",headers:{"x-requested-with":"me-ish"},body:form}))).status).toBe(400);expect(mocks.submit).not.toHaveBeenCalled();
 });
 it("ordinary quota is enforced only for a new operation",async()=>{
  mocks.rate.mockResolvedValueOnce({allowed:true}).mockResolvedValueOnce({allowed:false});
  expect((await POST(req({...fields,operationId,requestHash:hash}))).status).toBe(429);expect(mocks.submit).not.toHaveBeenCalled();expect(mocks.rate.mock.calls[1][1].limit).toBe(3);
 });
});
