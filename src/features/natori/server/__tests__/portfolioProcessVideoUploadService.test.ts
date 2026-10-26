import { beforeEach, describe, expect, it, vi } from "vitest";

// Domain tests use an unheld admission boundary; actual denial/SQL are covered separately.
vi.mock("../caseSystemHold",()=>({assertCaseSystemAdmission:vi.fn(async()=>{})}));
vi.mock("server-only", () => ({}));

const { mockCreateSignedUploadUrl, mockGetPublicUrl, mockStorageFrom } = vi.hoisted(() => ({
  mockCreateSignedUploadUrl: vi.fn(),
  mockGetPublicUrl: vi.fn(),
  mockStorageFrom: vi.fn(),
}));

vi.mock("@/features/natori/server/natoriOwner",()=>({resolveNatoriOwnerId:async()=>"00000000-0000-4000-8000-000000000011"}));
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: vi.fn(() => ({from:vi.fn(()=>({insert:async()=>({error:null})})),
    storage: {
      from: (...args: unknown[]) => mockStorageFrom(...args),
    },
  })),
}));

import { parseProcessVideoFileUrl } from "@/features/natori/lib/portfolioProcessVideo";
import { prepareProcessVideoUpload } from "@/features/natori/server/portfolioProcessVideoUploadService";

const PUBLIC_ORIGIN = "https://abcdefgh.supabase.co/storage/v1/object/public/natori-portfolio/";

beforeEach(() => {
  vi.clearAllMocks();
  mockStorageFrom.mockReturnValue({
    createSignedUploadUrl: mockCreateSignedUploadUrl,
    getPublicUrl: mockGetPublicUrl,
  });
  mockCreateSignedUploadUrl.mockResolvedValue({
    data: { signedUrl: "https://signed.invalid/upload", token: "upload-token", path: "ignored" },
    error: null,
  });
  mockGetPublicUrl.mockImplementation((path: string) => ({ data: { url: `${PUBLIC_ORIGIN}${path}` } }));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("prepareProcessVideoUpload", () => {
  it("private stagingの所有者パスだけに署名付きアップロードを発行する", async () => {
    const result = await prepareProcessVideoUpload({ sizeBytes: 30_000_000, contentType: "video/mp4" });

    expect(result).toEqual({
      kind: "ok",
      assetId:expect.any(String),
      path: expect.stringMatching(/^portfolio-staging\/00000000-0000-4000-8000-000000000011\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.mp4$/u),
      token: "upload-token",
      url: expect.stringMatching(/^\/api\/natori\/admin\/portfolio-assets\//u),
    });
    expect(mockStorageFrom).toHaveBeenCalledWith("natori-management-assets");
    // 標準uploadの上書きを無効化し、TUS replayもstagingに閉じ込める
    expect(mockCreateSignedUploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^portfolio-staging\/00000000-0000-4000-8000-000000000011\/.+\.mp4$/u),
      { upsert: false }
    );
    if (result.kind === "ok") {
      // 返した公開URLは、そのまま掲載内容に保存できる形（保存前検証を通る）
      expect(parseProcessVideoFileUrl(result.url)).toBe(result.url);
      expect(mockGetPublicUrl).not.toHaveBeenCalled();
    }
  });

  it("呼ぶたびに別の場所を使う", async () => {
    const first = await prepareProcessVideoUpload({ sizeBytes: 1000, contentType: "video/mp4" });
    const second = await prepareProcessVideoUpload({ sizeBytes: 1000, contentType: "video/mp4" });
    expect(first.kind === "ok" && second.kind === "ok" && first.path !== second.path).toBe(true);
  });

  it("MP4 以外・空のファイル・上限超えは、Storage に触れる前に断る", async () => {
    await expect(prepareProcessVideoUpload({ sizeBytes: 1000, contentType: "video/quicktime" })).resolves.toEqual({
      kind: "invalid-type",
    });
    await expect(prepareProcessVideoUpload({ sizeBytes: 1000, contentType: "" })).resolves.toEqual({
      kind: "invalid-type",
    });
    await expect(prepareProcessVideoUpload({ sizeBytes: 0, contentType: "video/mp4" })).resolves.toEqual({
      kind: "empty",
    });
    await expect(prepareProcessVideoUpload({ sizeBytes: 50_000_001, contentType: "video/mp4" })).resolves.toEqual({
      kind: "too-large",
    });
    expect(mockStorageFrom).not.toHaveBeenCalled();
    expect(mockCreateSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("上限ちょうどは通す", async () => {
    await expect(prepareProcessVideoUpload({ sizeBytes: 50_000_000, contentType: "video/mp4" })).resolves.toMatchObject({
      kind: "ok",
    });
  });

  it("署名付きURLを発行できなければ storage-error（パスやトークンは返さない）", async () => {
    mockCreateSignedUploadUrl.mockResolvedValueOnce({ data: null, error: { message: "unavailable" } });
    await expect(prepareProcessVideoUpload({ sizeBytes: 1000, contentType: "video/mp4" })).resolves.toEqual({
      kind: "storage-error",
    });
    expect(mockGetPublicUrl).not.toHaveBeenCalled();
  });
});
