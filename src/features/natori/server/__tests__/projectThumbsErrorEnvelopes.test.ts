import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ project: vi.fn(), fetch: vi.fn<typeof fetch>(), storage: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../natoriOwner", () => ({ resolveNatoriOwnerId: async () => "synthetic-owner" }));
vi.mock("../natoriManagementRoute", () => ({
  withNatoriManagement: <T>(_name: string, _mutating: boolean, handler: T): T => handler,
}));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({
  from: () => {
    const query = { select: () => query, eq: () => query, maybeSingle: mocks.project };
    return query;
  },
  storage: { from: mocks.storage },
}) }));
import { GET } from "@/app/api/natori/admin/project-thumbs/[projectId]/route";

const projectId = "00000000-0000-4000-8000-000000000123";
type Fixture = { status?: number; body?: unknown; raw?: string; network?: boolean; image?: boolean };
type Scenario = {
  name: string; first: Fixture; second?: Fixture; expectedStatus: number; expectedCalls: number;
  ownerMissing?: boolean; ownerChanges?: boolean; ownershipError?: "initial" | "recheck";
};
const canonical = { statusCode: "404", code: "NoSuchKey", message: "Object not found" };
// S3 envelope recorded by the repository's historical pinned-SDK fixture.
const s3 = { statusCode: "404", code: "S3Error", message: "NoSuchKey" };
// Narrow Object-not-found variants from the isolated reproduction, not a
// statement about the currently deployed Storage backend's response format.
const localMessageOnly = { statusCode: "404", message: "Object not found" };
const localNotFound = { statusCode: "404", error: "not_found", message: "Object not found" };
const alternatives = [s3, localMessageOnly, localNotFound];
const missing = (body: unknown = canonical, status = 400): Fixture => ({ status, body });
const image: Fixture = { image: true };
const cases: Scenario[] = [
  { name: "private image", first: image, expectedStatus: 200, expectedCalls: 1 },
  ...[400, 404].map((status): Scenario => ({ name: `canonical NoSuchKey HTTP${status}`, first: missing(canonical, status), second: image, expectedStatus: 200, expectedCalls: 2 })),
  { name: "canonical missing in both", first: missing(), second: missing(), expectedStatus: 404, expectedCalls: 2 },
  ...[400, 404].flatMap((status) => alternatives.map((body, index): Scenario => ({
    name: `known missing variant${index} HTTP${status}`, first: missing(body, status), second: image, expectedStatus: 200, expectedCalls: 2,
  }))),
  { name: "legacy also missing S3Error", first: missing(), second: missing(s3), expectedStatus: 404, expectedCalls: 2 },
  { name: "legacy also missing Object not found", first: missing(), second: missing(localNotFound), expectedStatus: 404, expectedCalls: 2 },
  ...[
    { name: "NoSuchBucket", status: 400, body: { statusCode: "404", code: "NoSuchBucket", message: "Bucket not found" } },
    { name: "S3Error NoSuchBucket", status: 400, body: { statusCode: "404", code: "S3Error", message: "NoSuchBucket" } },
    { name: "AccessDenied with misleading message", status: 400, body: { statusCode: "404", code: "AccessDenied", message: "Object not found" } },
    { name: "NoSuchBucket with misleading message", status: 400, body: { statusCode: "404", code: "NoSuchBucket", message: "Object not found" } },
    { name: "HTTP403 with missing envelope", status: 403, body: s3 },
    { name: "HTTP401 with missing envelope", status: 401, body: s3 },
    { name: "semantic403 with missing text", status: 400, body: { statusCode: "403", code: "S3Error", message: "NoSuchKey" } },
    { name: "HTTP503 with missing envelope", status: 503, body: s3 },
    { name: "ambiguous S3Error", status: 400, body: { statusCode: "404", code: "S3Error", message: "Storage operation failed" } },
    { name: "S3Error with conflicting AccessDenied", status: 400, body: { ...s3, error: "AccessDenied" } },
    { name: "S3Error with conflicting NoSuchBucket", status: 400, body: { ...s3, error: "NoSuchBucket" } },
    { name: "message with denied error", status: 400, body: { ...localMessageOnly, error: "AccessDenied" } },
    { name: "message with bucket error", status: 400, body: { ...localMessageOnly, error: "NoSuchBucket" } },
    { name: "message with unknown code", status: 400, body: { ...localMessageOnly, code: "UnknownError" } },
    { name: "S3Error with unrelated not-found text", status: 400, body: { ...s3, message: "Bucket not found" } },
    { name: "S3Error with partial message", status: 400, body: { ...s3, message: "NoSuchKey: unverified detail" } },
    { name: "message without semantic status", status: 400, body: { message: "Object not found" } },
    { name: "missing text under HTTP403", status: 403, body: localMessageOnly },
    { name: "empty legacy error", status: 400, body: { ...localMessageOnly, error: "" } },
    { name: "null code", status: 400, body: { ...localMessageOnly, code: null } },
  ].map(({ name, status, body }): Scenario => ({ name, first: { status, body }, expectedStatus: 503, expectedCalls: 1 })),
  { name: "malformed JSON", first: { status: 400, raw: "not-json" }, expectedStatus: 503, expectedCalls: 1 },
  { name: "network failure", first: { network: true }, expectedStatus: 503, expectedCalls: 1 },
  { name: "legacy access denied", first: missing(), second: { status: 403, body: { statusCode: "403", code: "AccessDenied" } }, expectedStatus: 503, expectedCalls: 2 },
  { name: "absent ownership", first: image, expectedStatus: 404, expectedCalls: 0, ownerMissing: true },
  { name: "ownership changed after legacy fetch", first: missing(), second: image, expectedStatus: 404, expectedCalls: 2, ownerChanges: true },
  ...alternatives.map((body, index): Scenario => ({ name: `ownership changed for variant${index}`, first: missing(body), second: image, expectedStatus: 404, expectedCalls: 2, ownerChanges: true })),
  ...alternatives.map((body, index): Scenario => ({ name: `numeric semantic404 variant${index}`, first: missing({ ...body, statusCode: 404 }), second: image, expectedStatus: 200, expectedCalls: 2 })),
  { name: "initial ownership lookup fails", first: image, expectedStatus: 503, expectedCalls: 0, ownershipError: "initial" },
  { name: "ownership recheck fails after S3 fallback", first: missing(s3), second: image, expectedStatus: 503, expectedCalls: 2, ownershipError: "recheck" },
];

let responses: Response[] = [];
beforeEach(() => {
  vi.resetAllMocks(); responses = [];
  // Real pinned SDK; only the transport and authorization/database are mocks.
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected live fetch forbidden"); }));
  const client = createClient("https://storage.synthetic.invalid", "synthetic-key", {
    accessToken: async () => "synthetic-token",
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: mocks.fetch },
  });
  mocks.project.mockResolvedValue({ data: { id: projectId }, error: null });
  mocks.storage.mockImplementation((bucket: string) => client.storage.from(bucket));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it.each(cases)("$name", async (scenario) => {
  if (scenario.ownerMissing) mocks.project.mockResolvedValueOnce({ data: null, error: null });
  if (scenario.ownerChanges || scenario.ownershipError === "recheck") {
    mocks.project.mockResolvedValueOnce({ data: { id: projectId }, error: null })
      .mockResolvedValueOnce({ data: null, error: scenario.ownershipError ? new Error("Synthetic DB failure") : null });
  }
  if (scenario.ownershipError === "initial") mocks.project.mockResolvedValueOnce({ data: null, error: new Error("Synthetic DB failure") });
  mocks.fetch.mockImplementation(async () => {
    const fixture = mocks.fetch.mock.calls.length === 1 ? scenario.first : scenario.second;
    if (!fixture) throw new Error("Unexpected unplanned fetch");
    if (fixture.network) throw new TypeError("Synthetic network failure");
    const response = fixture.image
      ? new Response("synthetic-image", { headers: { "Content-Type": "image/webp" } })
      : new Response(fixture.raw ?? JSON.stringify(fixture.body), { status: fixture.status, headers: { "Content-Type": "application/json" } });
    responses.push(response);
    return response;
  });
  const response = await GET(new Request("http://synthetic.invalid/image"), { params: Promise.resolve({ projectId }) });
  expect(response.status).toBe(scenario.expectedStatus);
  expect(mocks.fetch).toHaveBeenCalledTimes(scenario.expectedCalls);
  expect(mocks.storage.mock.calls.map(([bucket]) => bucket)).toEqual(scenario.expectedCalls === 0 ? []
    : scenario.expectedCalls === 1 ? ["natori-management-assets"] : ["natori-management-assets", "natori-portfolio"]);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(responses.filter((upstream) => upstream.status >= 400).every((upstream) => !upstream.bodyUsed)).toBe(true);
  if (response.status === 200) {
    expect(await response.text()).toBe("synthetic-image");
    expect(mocks.project).toHaveBeenCalledTimes(2);
  }
});
