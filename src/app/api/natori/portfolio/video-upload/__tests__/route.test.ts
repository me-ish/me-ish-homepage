import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ canEdit: vi.fn(), prepare: vi.fn() }));

vi.mock("@/features/natori/server/portfolioSiteService", () => ({
  canEditNatoriPortfolio: mocks.canEdit,
}));
vi.mock("@/features/natori/server/portfolioProcessVideoUploadService", () => ({
  prepareProcessVideoUpload: mocks.prepare,
}));

import { POST } from "../route";

const PUBLIC_URL =
  "https://abcdefgh.supabase.co/storage/v1/object/public/natori-portfolio/videos/3f2b8c1e-9d4a-4b7e-8a1f-0c5d6e7f8a9b.mp4";

function request(body: unknown, headers: Record<string, string> = { "x-requested-with": "me-ish" }): Request {
  return new Request("http://localhost/api/natori/portfolio/video-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validBody = { sizeBytes: 30_000_000, contentType: "video/mp4" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.canEdit.mockResolvedValue(true);
  mocks.prepare.mockResolvedValue({
    kind: "ok",
    path: "videos/3f2b8c1e-9d4a-4b7e-8a1f-0c5d6e7f8a9b.mp4",
    token: "upload-token",
    publicUrl: PUBLIC_URL,
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/natori/portfolio/video-upload", () => {
  it("編集できる人には、署名付きアップロードの情報を返す", async () => {
    const response = await POST(request(validBody));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      path: "videos/3f2b8c1e-9d4a-4b7e-8a1f-0c5d6e7f8a9b.mp4",
      token: "upload-token",
      publicUrl: PUBLIC_URL,
    });
    expect(mocks.prepare).toHaveBeenCalledWith(validBody);
  });

  it("CSRF ヘッダーが無ければ、認可の確認より前に 403 で断る", async () => {
    const response = await POST(request(validBody, {}));

    expect(response.status).toBe(403);
    expect(mocks.canEdit).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it("編集権限のない人には 401 を返し、署名付きURLを発行しない", async () => {
    mocks.canEdit.mockResolvedValue(false);
    const response = await POST(request(validBody));

    expect(response.status).toBe(401);
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it.each([
    ["JSON ではない", "not json"],
    ["空のオブジェクト", {}],
    ["大きさが文字列", { sizeBytes: "30", contentType: "video/mp4" }],
    ["大きさが小数", { sizeBytes: 1.5, contentType: "video/mp4" }],
    ["大きさが負", { sizeBytes: -1, contentType: "video/mp4" }],
    ["種類が無い", { sizeBytes: 100 }],
    ["種類が長すぎる", { sizeBytes: 100, contentType: "v".repeat(101) }],
  ])("要求の形が正しくなければ 400（%s）", async (_label, body) => {
    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_body" });
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid-type", 400, "invalid_mime"],
    ["empty", 400, "file_empty"],
    ["too-large", 400, "file_too_large"],
    ["storage-error", 500, "storage_error"],
  ])("準備の結果 %s は %i と %s に対応させる", async (kind, status, error) => {
    mocks.prepare.mockResolvedValue({ kind });
    const response = await POST(request(validBody));

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
  });

  it("想定外の例外は 500 にして、内容は返さない", async () => {
    mocks.prepare.mockRejectedValue(new Error("boom: secret detail"));
    const response = await POST(request(validBody));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "internal_error" });
  });
});
