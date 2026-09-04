// Storage orphan 棚卸し endpoint のテスト。
// 認証、GET dry-run / POST dryRun=0 の契約、offset の受け渡しと不正値拒否を固定する。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const { mockScan } = vi.hoisted(() => ({ mockScan: vi.fn() }));

vi.mock("@/features/natori/server/inquiryOrphanService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/natori/server/inquiryOrphanService")>();
  return {
    ...actual,
    scanNatoriInquiryReferenceOrphans: (...args: unknown[]) => mockScan(...args),
  };
});

import { GET, POST } from "../route";

const BASE = "https://example.com/api/natori/maintenance/inquiry-orphans";
const ADMIN_TOKEN = "test-admin-token";

function makeReq(query = "", headers: Record<string, string> = {}) {
  return new NextRequest(`${BASE}${query}`, {
    headers: { "x-meish-admin-token": ADMIN_TOKEN, ...headers },
  });
}

function scanArg() {
  return mockScan.mock.calls[0][0] as {
    dryRun: boolean;
    startOffset?: number;
    maxDeletions?: number;
    minimumAgeMs?: number;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_API_TOKEN", ADMIN_TOKEN);
  vi.stubEnv("CRON_SECRET", "");
  mockScan.mockResolvedValue({
    kind: "ok",
    dryRun: true,
    startOffset: 0,
    scannedPrefixes: 3,
    inspectedObjects: 4,
    candidateCount: 1,
    deletedCount: 0,
    truncated: false,
    nextOffset: null,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("認証", () => {
  it("token が無ければ 401 で scan しない", async () => {
    const res = await GET(new NextRequest(BASE));
    expect(res.status).toBe(401);
    expect(mockScan).not.toHaveBeenCalled();
  });

  it("CRON_SECRET の Bearer でも通る", async () => {
    vi.stubEnv("ADMIN_API_TOKEN", "");
    vi.stubEnv("CRON_SECRET", "cron-secret");
    const res = await GET(
      new NextRequest(BASE, { headers: { authorization: "Bearer cron-secret" } })
    );
    expect(res.status).toBe(200);
  });
});

describe("dry-run 契約", () => {
  it("GET は dryRun=0 を指定しても dry-run のまま", async () => {
    const res = await GET(makeReq("?dryRun=0"));
    expect(res.status).toBe(200);
    expect(scanArg().dryRun).toBe(true);
  });

  it("POST は既定で dry-run", async () => {
    await POST(makeReq());
    expect(scanArg().dryRun).toBe(true);
  });

  it("POST + dryRun=0 のときだけ削除を許す", async () => {
    await POST(makeReq("?dryRun=0"));
    expect(scanArg().dryRun).toBe(false);
  });
});

describe("offset / pagination", () => {
  it("offset 未指定なら service へ undefined を渡す", async () => {
    await GET(makeReq());
    expect(scanArg().startOffset).toBeUndefined();
  });

  it("offset を service へ渡す", async () => {
    await GET(makeReq("?offset=200"));
    expect(scanArg().startOffset).toBe(200);
  });

  it("offset=0 を明示指定できる", async () => {
    await GET(makeReq("?offset=0"));
    expect(scanArg().startOffset).toBe(0);
  });

  it("nextOffset / truncated を response に返す", async () => {
    mockScan.mockResolvedValue({
      kind: "ok",
      dryRun: true,
      startOffset: 200,
      scannedPrefixes: 200,
      inspectedObjects: 200,
      candidateCount: 5,
      deletedCount: 0,
      truncated: true,
      nextOffset: 400,
    });
    const res = await GET(makeReq("?offset=200"));
    const json = await res.json();
    expect(json).toMatchObject({
      ok: true,
      scannedPrefixes: 200,
      inspectedObjects: 200,
      candidateCount: 5,
      deletedCount: 0,
      truncated: true,
      nextOffset: 400,
    });
  });

  it.each([
    ["?offset=-1", "offset"],
    ["?offset=abc", "offset"],
    ["?offset=1.5", "offset"],
    ["?offset=99999999", "offset"],
    ["?minAgeHours=0", "minAgeHours"],
    ["?limit=0", "limit"],
    ["?limit=9999", "limit"],
  ])("不正な %s は 400 で拒否し、scan しない", async (query, parameter) => {
    const res = await GET(makeReq(query));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false, error: "invalid_parameter", parameter });
    expect(mockScan).not.toHaveBeenCalled();
  });
});

describe("失敗時", () => {
  it("scan が unavailable なら 503 で、path も secret も返さない", async () => {
    mockScan.mockResolvedValue({ kind: "unavailable" });
    const res = await GET(makeReq());
    expect(res.status).toBe(503);
    const body = JSON.stringify(await res.json());
    expect(body).toBe(JSON.stringify({ ok: false, error: "scan_unavailable" }));
    expect(body).not.toContain(ADMIN_TOKEN);
    expect(body).not.toContain(".webp");
  });
});
