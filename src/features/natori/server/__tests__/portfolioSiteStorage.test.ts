import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  mockCreateSignedUrl,
  mockGetPublicUrl,
  mockRemove,
  mockStorageFrom,
  mockToBuffer,
  mockUpload,
} = vi.hoisted(() => ({
  mockCreateSignedUrl: vi.fn(),
  mockGetPublicUrl: vi.fn(),
  mockRemove: vi.fn(),
  mockStorageFrom: vi.fn(),
  mockToBuffer: vi.fn(),
  mockUpload: vi.fn(),
}));

vi.mock("sharp", () => ({
  default: vi.fn(() => {
    const pipeline = {
      rotate: vi.fn(() => pipeline),
      resize: vi.fn(() => pipeline),
      webp: vi.fn(() => pipeline),
      toBuffer: mockToBuffer,
    };
    return pipeline;
  }),
}));

vi.mock("@/lib/imageSniff", () => ({
  sniffImageFormat: vi.fn(() => "png"),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: vi.fn(() => ({
    storage: {
      from: (...args: unknown[]) => mockStorageFrom(...args),
    },
  })),
}));

vi.mock("@/features/natori/server/requireNatoriAdmin", () => ({
  canUseNatoriManagement: vi.fn().mockResolvedValue(true),
}));

import {
  deletePortfolioReferenceImages,
  signPortfolioReferenceImage,
  uploadPortfolioImage,
  uploadPortfolioReferenceImage,
} from "@/features/natori/server/portfolioSiteService";

const storageBucket = {
  createSignedUrl: mockCreateSignedUrl,
  getPublicUrl: mockGetPublicUrl,
  remove: mockRemove,
  upload: mockUpload,
};

function imageFile(): File {
  const bytes = new Uint8Array([137, 80, 78, 71]);
  return {
    name: "reference.png",
    type: "image/png",
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer,
  } as File;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStorageFrom.mockReturnValue(storageBucket);
  mockToBuffer.mockResolvedValue(Buffer.from("webp"));
  mockUpload.mockResolvedValue({ error: null });
  mockGetPublicUrl.mockReturnValue({
    data: { publicUrl: "https://public.invalid/image.webp" },
  });
  mockCreateSignedUrl.mockResolvedValue({
    data: { signedUrl: "https://signed.invalid/reference" },
    error: null,
  });
  mockRemove.mockResolvedValue({ error: null });
});

describe("Natori portfolio and inquiry-reference Storage", () => {
  it("uploads inquiry references through the server admin client under the submission path", async () => {
    const result = await uploadPortfolioReferenceImage(
      imageFile(),
      "submission-123",
    );

    expect(result).toEqual({
      kind: "ok",
      path: expect.stringMatching(
        /^submission-123\/[0-9a-f-]+\.webp$/i,
      ),
    });
    expect(mockStorageFrom).toHaveBeenCalledWith("natori-inquiry-refs");
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^submission-123\/[0-9a-f-]+\.webp$/i),
      expect.any(Buffer),
      { contentType: "image/webp", upsert: false },
    );
  });

  it("reports a private-reference upload error without returning a path", async () => {
    mockUpload.mockResolvedValueOnce({
      error: { message: "storage unavailable" },
    });

    await expect(
      uploadPortfolioReferenceImage(imageFile(), "submission-123"),
    ).resolves.toEqual({ kind: "upload-error" });
  });

  it("serves inquiry references only through signed URLs and scoped cleanup", async () => {
    await expect(
      signPortfolioReferenceImage("submission-123/reference.webp", 300),
    ).resolves.toBe("https://signed.invalid/reference");
    expect(mockStorageFrom).toHaveBeenCalledWith("natori-inquiry-refs");
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      "submission-123/reference.webp",
      300,
    );

    await deletePortfolioReferenceImages([
      "submission-123/reference.webp",
    ]);
    expect(mockRemove).toHaveBeenCalledWith([
      "submission-123/reference.webp",
    ]);
  });

  it("writes public portfolio images through the server admin client", async () => {
    await expect(uploadPortfolioImage(imageFile())).resolves.toEqual({
      kind: "ok",
      url: "https://public.invalid/image.webp",
    });
    expect(mockStorageFrom).toHaveBeenCalledWith("natori-portfolio");
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^images\/[0-9a-f-]+\.webp$/i),
      expect.any(Buffer),
      { contentType: "image/webp", upsert: false },
    );
  });
});
