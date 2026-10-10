import type { Check, TestContext } from "./test-context";

// The old upload product has ended. Keep a mandatory real-handler gate and
// retain the independent Natori upload/resume suite without legacy imports.
export async function createGallerySuite() {
  const { POST } = await import("../../src/app/api/entry/upload/route");
  const handler: (request: Request) => Promise<Response> = POST;
  const originalFetch = globalThis.fetch;
  async function run(context: TestContext) {
    const check: Check = context.check;
    await context.test("retired-upload-stops-before-effects", async () => {
      globalThis.fetch = async () => { throw new Error("RETIRED_UPLOAD_NETWORK"); };
      try {
        for (const body of ['{"action":"sign"}', '{"action":"finish","receipt":"old"}', 'invalid']) {
          const request = new Request("http://localhost:3000/api/entry/upload", {
            method: "POST", body, headers: { "content-type": "application/json" },
          });
          const response = await handler(request);
          check(response.status === 503, "RETIRED_UPLOAD_STATUS");
          check(response.headers.get("cache-control") === "no-store", "RETIRED_UPLOAD_CACHE");
          check((await response.json()).error === "legacy_service_paused", "RETIRED_UPLOAD_BODY");
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  }
  return { run, restore: () => { globalThis.fetch = originalFetch; } };
}
