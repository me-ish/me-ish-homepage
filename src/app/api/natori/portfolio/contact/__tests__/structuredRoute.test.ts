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
import { buildNatoriRequestDataV1, createInitialPortfolioRequestFormState } from "@/features/natori/lib/portfolioRequestForm";
const structured=()=>({...fields,formVersion:"etorie-request-v1",requestData:JSON.stringify(buildNatoriRequestDataV1({...createInitialPortfolioRequestFormState(),message:"Structured original"},[])),referenceLinks:"[]"});
function multipart(input:Record<string,string>,files:File[]=[]){const form=new FormData();for(const[k,v]of Object.entries(input))form.set(k,v);for(const file of files)form.append("refImages",file);return new Request("http://localhost/api/natori/portfolio/contact",{method:"POST",headers:{"x-requested-with":"me-ish"},body:form});}
function withHash(input:Record<string,string>){return {...input,operationId,requestHash:createHash("sha256").update(canonicalIntakeJson(canonicalizeIntake(input,[]))).digest("hex")};}
describe("structured envelope and atomic writer cutover",()=>{
 it("passes canonical request to one operation writer without client owner trust",async()=>{
  const input=withHash(structured());expect((await POST(multipart({...input,ownerId:"attacker",user_id:"attacker"}))).status).toBe(202);
  expect(mocks.submit.mock.calls[0][1].submission).toMatchObject({clientName:fields.name,clientEmail:fields.email,requestData:{message:"Structured original",legacySource:null}});
 });
 it("rejects structured JSON and supports only multipart for new structured uploads",async()=>{
  expect((await POST(req(withHash(structured())))).status).toBe(400);expect(mocks.submit).not.toHaveBeenCalled();
 });
 it.each(["commercialUse","publicationPolicy","requestType"])("rejects invalid canonical %s before begin",async key=>{
  const input=structured(),data=JSON.parse(input.requestData);data[key]="invalid";input.requestData=JSON.stringify(data);
  expect((await POST(multipart({...input,operationId,requestHash:hash}))).status).toBe(400);expect(mocks.lookup).not.toHaveBeenCalled();expect(mocks.submit).not.toHaveBeenCalled();
 });
 it.each(["http://example.com/ref","https://user:pass@example.com/ref","javascript:alert(1)"])("rejects unsupported or credential-bearing reference URL %s",async url=>{
  const input=structured();input.referenceLinks=JSON.stringify([{url,label:"ref"}]);
  expect((await POST(multipart({...input,operationId,requestHash:hash}))).status).toBe(400);expect(mocks.lookup).not.toHaveBeenCalled();
 });
 it("rejects changed attachment manifest and unsupported file MIME before begin",async()=>{
  const input=withHash(structured());expect((await POST(multipart(input,[new File(["changed"],"ref.png",{type:"image/png"})]))).status).toBe(409);
  expect((await POST(multipart(input,[new File(["fake"],"ref.svg",{type:"image/svg+xml"})]))).status).toBe(400);expect(mocks.lookup).not.toHaveBeenCalled();
 });
 it("unknown atomic writer outcome is retryable and never reported as successful mail delivery",async()=>{
  mocks.submit.mockResolvedValue({kind:"unavailable"});const response=await POST(multipart(withHash(structured())));expect(response.status).toBe(503);expect(await response.json()).toMatchObject({ok:false,operationState:"unknown"});
 });
});
