import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const run = vi.hoisted(() => vi.fn());
const complete = vi.hoisted(() => vi.fn());
vi.mock("@/features/natori/server/caseAnonymizationService", () => ({ runScheduledNatoriAnonymization: run }));
vi.mock("@/features/natori/server/scheduledCaseCompletion", () => ({ runScheduledNatoriDeemedCompletion: complete }));

import { GET } from "../route";

const request = (auth?: string) => new NextRequest("https://example.test/api/cron/natori-anonymize", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "secret");
  vi.stubEnv("ADMIN_API_TOKEN", "");
  run.mockReset();
  complete.mockReset();
  complete.mockResolvedValue({ checked: 0, applied: 0, skipped: 0, failed: 0 });
  run.mockResolvedValue({ checked: 1, applied: 1, skipped: 0, failed: 0, filesRetried: 0, filesPending: 0 });
});
afterEach(() => vi.unstubAllEnvs());

describe("natori anonymize cron", () => {
  it("rejects calls without the cron secret", async () => {
    expect((await GET(request())).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it("completes expired deliveries before anonymizing, and keeps anonymizing when that step fails", async () => {
    const order: string[] = [];
    complete.mockImplementation(async () => { order.push("complete"); return { checked: 1, applied: 1, skipped: 0, failed: 0 }; });
    run.mockImplementation(async () => { order.push("anonymize"); return { checked: 0, applied: 0, skipped: 0, failed: 0, filesRetried: 0, filesPending: 0 }; });
    const res = await GET(request("Bearer secret"));
    expect(res.status).toBe(200);
    expect(order).toEqual(["complete", "anonymize"]);
    expect((await res.json()).completion).toEqual({ checked: 1, applied: 1, skipped: 0, failed: 0 });

    complete.mockRejectedValue(new Error("down"));
    expect((await GET(request("Bearer secret"))).status).toBe(500);
    expect(run).toHaveBeenCalledTimes(2);
    complete.mockResolvedValue({ checked: 1, applied: 0, skipped: 0, failed: 1 });
    expect((await GET(request("Bearer secret"))).status).toBe(500);
  });

  it("runs and reports leftovers as a failure", async () => {
    expect((await GET(request("Bearer secret"))).status).toBe(200);
    run.mockResolvedValue({ checked: 1, applied: 1, skipped: 0, failed: 0, filesRetried: 0, filesPending: 1 });
    expect((await GET(request("Bearer secret"))).status).toBe(500);
  });
});
