import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient, mockStorageFrom, mockUploadToSignedUrl } =
  vi.hoisted(() => ({
    mockCreateClient: vi.fn(),
    mockStorageFrom: vi.fn(),
    mockUploadToSignedUrl: vi.fn(),
  }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: mockCreateClient,
}));

const mockTusUpload = vi.hoisted(() => vi.fn());
vi.mock("tus-js-client", () => ({
  Upload: class {
    constructor(file: unknown, private options: { onSuccess: () => void }) { mockTusUpload(file, options); }
    start() { this.options.onSuccess(); }
  },
}));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

import { uploadNatoriDeliveryFile, verifyNatoriDeliveryFile } from "@/features/natori/data/supabaseDeliveryFiles";

function response(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const file = {
  name: "delivery.pdf",
  size: 1234,
} as File;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://storage.fixture.invalid");
  mockStorageFrom.mockReturnValue({
    uploadToSignedUrl: mockUploadToSignedUrl,
  });
  mockCreateClient.mockReturnValue({
    storage: { from: mockStorageFrom },
  });
  mockUploadToSignedUrl.mockResolvedValue({ error: null });
});

describe("browser delivery upload", () => {
  it("uses only the server-issued path and signed token", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      response({
        ok: true,
        fileId: "file-1",
        path: "project-1/final/file.pdf",
        token: "signed-token",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await uploadNatoriDeliveryFile(
      "project-1",
      "final",
      file,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/natori/admin/delivery-files",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mockCreateClient).toHaveBeenCalledWith();
    expect(mockStorageFrom).toHaveBeenCalledWith("natori-deliveries");
    expect(mockUploadToSignedUrl).toHaveBeenCalledWith(
      "project-1/final/file.pdf",
      "signed-token",
      file,
      { contentType: "application/octet-stream" },
    );
  });

  it("keeps the reservation when the upload result is unconfirmed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          ok: true,
          fileId: "file-1",
          path: "project-1/final/file.pdf",
          token: "signed-token",
        }),
      )
      .mockResolvedValueOnce(response({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    mockUploadToSignedUrl.mockResolvedValueOnce({
      error: { message: "upload failed" },
    });

    await expect(
      uploadNatoriDeliveryFile("project-1", "final", file),
    ).rejects.toThrow("アップロードの完了を確認できません");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries only finalization after a lost finalize response", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ ok: true, fileId: "file-1",
      path: "project-1/final/file.pdf", token: "signed-token", requiresFinalize: true }))
      .mockResolvedValueOnce(response({}, 503)).mockResolvedValueOnce(response({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(uploadNatoriDeliveryFile("project-1", "final", file)).rejects.toThrow("保存を確認できません");
    await verifyNatoriDeliveryFile("file-1");
    expect(mockUploadToSignedUrl).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.slice(1).every(([, init]) => init.method === "PATCH")).toBe(true);
  });
});

describe("50MB browser upload boundary", () => {
  it.each([false, true])("accepts exactly 50,000,000 bytes (finalize=%s)", async requiresFinalize => {
    const boundary = { name: "boundary.bin", size: 50_000_000, type: "application/octet-stream" } as File;
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ ok: true, fileId: "file-1",
      path: "project-1/final/boundary.bin", token: "signed-token", requiresFinalize }))
      .mockResolvedValueOnce(response({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await uploadNatoriDeliveryFile("project-1", "final", boundary);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).sizeBytes).toBe(50_000_000);
    if (requiresFinalize) {
      expect(mockTusUpload).toHaveBeenCalledWith(boundary, expect.objectContaining({ chunkSize: 6 * 1024 * 1024 }));
      expect(mockUploadToSignedUrl).not.toHaveBeenCalled();
      expect(fetchMock.mock.calls[1][1].method).toBe("PATCH");
    } else expect(mockUploadToSignedUrl).toHaveBeenCalledTimes(1);
  });

  it.each(["rough", "final"] as const)("rejects +1 byte before network or Storage access (%s)", async folder => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(uploadNatoriDeliveryFile("project-1", folder,
      { name: "oversize.bin", size: 50_000_001 } as File)).rejects.toThrow("ファイルは1つ50MBまでです");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockTusUpload).not.toHaveBeenCalled();
  });
});
