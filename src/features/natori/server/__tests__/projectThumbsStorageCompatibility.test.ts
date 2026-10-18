import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  owner: vi.fn(),
  project: vi.fn(),
  eq: vi.fn(),
  storageFrom: vi.fn(),
  fetch: vi.fn<typeof fetch>(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../natoriOwner", () => ({ resolveNatoriOwnerId: mocks.owner }));
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: () => ({
    from: () => {
      const chain = {
        select: () => chain,
        eq: (...args: unknown[]) => { mocks.eq(...args); return chain; },
        maybeSingle: mocks.project,
      };
      return chain;
    },
    storage: { from: mocks.storageFrom },
  }),
}));
import { readNatoriProjectThumb } from "../projectThumbsService";

const PRIVATE_BUCKET = "natori-management-assets";
const LEGACY_BUCKET = "natori-portfolio";
const missingBody = {
  statusCode: "404", code: "NoSuchKey", error: "NoSuchKey", message: "Object not found",
};

function storageError(status: number, body: unknown = missingBody): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}

function imageResponse(): Response {
  return new Response("synthetic-image", { headers: { "Content-Type": "image/webp" } });
}

function requestedBuckets(): string[] {
  return mocks.storageFrom.mock.calls.map(([bucket]) => bucket);
}

beforeEach(() => {
  vi.resetAllMocks();
  // Real pinned SDK, synthetic transport only: missing fixtures must never
  // contact a hosted database, Storage service, or image URL.
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected live fetch"); }));
  const client = createClient("https://storage.synthetic.invalid", "fixture-key", {
    accessToken: async () => "fixture-token",
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: mocks.fetch },
  });
  mocks.storageFrom.mockImplementation((bucket: string) => client.storage.from(bucket));
  mocks.owner.mockResolvedValue("fixture-owner");
  mocks.project.mockResolvedValue({ data: { id: "fixture-project" }, error: null });
  mocks.fetch.mockImplementation(async () => imageResponse());
});

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("does not download anything when management authorization fails", async () => {
  mocks.owner.mockRejectedValueOnce(new Error("Unauthorized"));
  await expect(readNatoriProjectThumb("fixture-project")).rejects.toThrow("Unauthorized");
  expect(mocks.project).not.toHaveBeenCalled();
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it("fails closed if the initial ownership lookup fails", async () => {
  mocks.project.mockResolvedValueOnce({ data: null, error: new Error("DB unavailable") });
  await expect(readNatoriProjectThumb("fixture-project")).rejects.toThrow("authorization unavailable");
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it("uses a valid private image first and rechecks ownership before returning bytes", async () => {
  const image = await readNatoriProjectThumb("fixture-project");
  expect(await image?.text()).toBe("synthetic-image");
  expect(requestedBuckets()).toEqual([PRIVATE_BUCKET]);
  expect(mocks.fetch.mock.calls[0][0]).toBe(
    "https://storage.synthetic.invalid/storage/v1/object/natori-management-assets/project-thumbs/fixture-owner/fixture-project.webp",
  );
  expect(mocks.project).toHaveBeenCalledTimes(2);
});

it("exercises the actual SDK's wrapped failed-download Response", async () => {
  mocks.fetch.mockResolvedValueOnce(storageError(400));
  const result = await mocks.storageFrom(PRIVATE_BUCKET).download("synthetic.webp");
  expect(result.error.name).toBe("StorageUnknownError");
  expect("statusCode" in result.error).toBe(false);
  expect(result.error.originalError).toBeInstanceOf(Response);
  expect(await result.error.originalError.clone().json()).toEqual(missingBody);
});

it.each([400, 404])("reads the existing legacy image only for an exact NoSuchKey response (HTTP %s)", async (status) => {
  const missing = storageError(status);
  mocks.fetch.mockResolvedValueOnce(missing);
  const image = await readNatoriProjectThumb("fixture-project");
  expect(await image?.text()).toBe("synthetic-image");
  expect(requestedBuckets()).toEqual([PRIVATE_BUCKET, LEGACY_BUCKET]);
  expect(mocks.fetch.mock.calls[1][0]).toBe(
    "https://storage.synthetic.invalid/storage/v1/object/natori-portfolio/project-thumbs/fixture-project.webp",
  );
  expect(mocks.project).toHaveBeenCalledTimes(2);
  expect(missing.bodyUsed).toBe(false);
});

it("returns null when both private and legacy objects are genuinely absent", async () => {
  mocks.fetch.mockImplementation(async () => storageError(400));
  expect(await readNatoriProjectThumb("fixture-project")).toBeNull();
  expect(requestedBuckets()).toEqual([PRIVATE_BUCKET, LEGACY_BUCKET]);
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
});

it("does not release legacy bytes if ownership changed while downloading", async () => {
  mocks.fetch.mockResolvedValueOnce(storageError(400));
  mocks.project
    .mockResolvedValueOnce({ data: { id: "fixture-project" }, error: null })
    .mockResolvedValueOnce({ data: null, error: null });
  expect(await readNatoriProjectThumb("fixture-project")).toBeNull();
  expect(requestedBuckets()).toEqual([PRIVATE_BUCKET, LEGACY_BUCKET]);
});

it.each(["private", "legacy"])("fails closed if ownership cannot be rechecked after a %s download", async (bucket) => {
  if (bucket === "legacy") mocks.fetch.mockResolvedValueOnce(storageError(400));
  mocks.project
    .mockResolvedValueOnce({ data: { id: "fixture-project" }, error: null })
    .mockResolvedValueOnce({ data: null, error: new Error("DB unavailable") });
  await expect(readNatoriProjectThumb("fixture-project")).rejects.toThrow("authorization unavailable");
});

const nonMissingResponses: Array<[number, unknown]> = [
  [401, { statusCode: "401", code: "InvalidJWT" }],
  [403, { statusCode: "403", code: "AccessDenied" }],
  [403, missingBody],
  [400, { statusCode: "400", code: "InvalidRequest" }],
  [400, { statusCode: "404", code: "NoSuchBucket" }],
  [404, { statusCode: "404", code: "AccessDenied" }],
  [404, { statusCode: "404" }],
  [400, { statusCode: "400", code: "NoSuchKey" }],
  [503, missingBody],
  [503, { statusCode: "503", code: "InternalError" }],
  [400, null],
];
it.each(nonMissingResponses)("does not fall back on permission, malformed, or backend failures (%s, %j)", async (status, body) => {
  mocks.fetch.mockResolvedValueOnce(storageError(status, body));
  await expect(readNatoriProjectThumb("fixture-project")).rejects.toThrow("download unavailable");
  expect(requestedBuckets()).toEqual([PRIVATE_BUCKET]);
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
});

it("does not fall back when the response body is not JSON", async () => {
  mocks.fetch.mockResolvedValueOnce(new Response("not-json", { status: 404 }));
  await expect(readNatoriProjectThumb("fixture-project")).rejects.toThrow("download unavailable");
  expect(requestedBuckets()).toEqual([PRIVATE_BUCKET]);
});

it("does not fall back when the failed Response has already been consumed", async () => {
  const response = storageError(400);
  await response.text();
  mocks.fetch.mockResolvedValueOnce(response);
  await expect(readNatoriProjectThumb("fixture-project")).rejects.toThrow("download unavailable");
  expect(requestedBuckets()).toEqual([PRIVATE_BUCKET]);
});

it("does not fall back after a network failure", async () => {
  mocks.fetch.mockRejectedValueOnce(new TypeError("Synthetic network failure"));
  await expect(readNatoriProjectThumb("fixture-project")).rejects.toThrow("download unavailable");
  expect(requestedBuckets()).toEqual([PRIVATE_BUCKET]);
});

it("does not hide a legacy access denial as a missing image", async () => {
  mocks.fetch
    .mockResolvedValueOnce(storageError(400))
    .mockResolvedValueOnce(storageError(403, { statusCode: "403", code: "AccessDenied" }));
  await expect(readNatoriProjectThumb("fixture-project")).rejects.toThrow("download unavailable");
  expect(requestedBuckets()).toEqual([PRIVATE_BUCKET, LEGACY_BUCKET]);
});
