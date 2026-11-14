import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const run = vi.hoisted(() => vi.fn());
vi.mock("@/features/natori/server/caseAnonymizationService", () => ({ runScheduledNatoriAnonymization: run }));

import { GET } from "../route";

const request = (auth?: string) => new NextRequest("https://example.test/api/cron/natori-anonymize", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "secret");
  vi.stubEnv("ADMIN_API_TOKEN", "");
  run.mockReset();
  run.mockResolvedValue({ checked: 1, applied: 1, skipped: 0, failed: 0, filesRetried: 0, filesPending: 0 });
});
afterEach(() => vi.unstubAllEnvs());

describe("natori anonymize cron", () => {
  it("rejects calls without the cron secret", async () => {
    vi.stubEnv("NATORI_ANONYMIZE_SCHEDULE_ENABLED", "1");
    expect((await GET(request())).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("does nothing until the switch is on", async () => {
    vi.stubEnv("NATORI_ANONYMIZE_SCHEDULE_ENABLED", "");
    const response = await GET(request("Bearer secret"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, skipped: "schedule_disabled" });
    expect(run).not.toHaveBeenCalled();
  });

  it("runs when the switch is on and reports leftovers as a failure", async () => {
    vi.stubEnv("NATORI_ANONYMIZE_SCHEDULE_ENABLED", "1");
    expect((await GET(request("Bearer secret"))).status).toBe(200);
    run.mockResolvedValue({ checked: 1, applied: 1, skipped: 0, failed: 0, filesRetried: 0, filesPending: 1 });
    expect((await GET(request("Bearer secret"))).status).toBe(500);
  });
});
