import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient, mockStorageFrom, mockUploadToSignedUrl } =
  vi.hoisted(() => ({
    mockCreateClient: vi.fn(),
    mockStorageFrom: vi.fn(),
    mockUploadToSignedUrl: vi.fn(),
  }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: mockCreateClient,
}));

import { uploadNatoriDeliveryFile } from "@/features/natori/data/supabaseDeliveryFiles";

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
    );
  });

  it("cleans up the server ledger when the direct signed upload fails", async () => {
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
    ).rejects.toThrow("upload failed");

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/natori/admin/delivery-files",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ fileId: "file-1" }),
      }),
    );
  });
});
