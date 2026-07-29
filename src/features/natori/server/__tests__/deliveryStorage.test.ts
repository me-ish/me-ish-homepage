import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  mockAdminFrom,
  mockCreateSignedUploadUrl,
  mockCreateSignedUrl,
  mockInsert,
  mockStorageFrom,
} = vi.hoisted(() => ({
  mockAdminFrom: vi.fn(),
  mockCreateSignedUploadUrl: vi.fn(),
  mockCreateSignedUrl: vi.fn(),
  mockInsert: vi.fn(),
  mockStorageFrom: vi.fn(),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: vi.fn(() => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
    storage: {
      from: (...args: unknown[]) => mockStorageFrom(...args),
    },
  })),
}));

vi.mock("@/features/natori/server/natoriOwner", () => ({
  resolveNatoriActingUserId: vi.fn().mockResolvedValue("owner-1"),
}));

vi.mock("@/features/natori/server/orderMailService", () => ({
  sendNatoriNoticeMail: vi.fn().mockResolvedValue(true),
}));

import {
  getNatoriDeliveryByToken,
  signNatoriDeliveryUpload,
} from "@/features/natori/server/deliveryService";

type QueryResult = {
  count?: number | null;
  data: unknown;
  error: unknown;
};

function query(result: QueryResult) {
  const chain: unknown = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") {
          return (
            resolve: (value: QueryResult) => void,
          ) => resolve(result);
        }
        if (prop === "single" || prop === "maybeSingle") {
          return vi.fn().mockResolvedValue(result);
        }
        return vi.fn(() => chain);
      },
    },
  );
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStorageFrom.mockReturnValue({
    createSignedUploadUrl: mockCreateSignedUploadUrl,
    createSignedUrl: mockCreateSignedUrl,
  });
  mockCreateSignedUploadUrl.mockResolvedValue({
    data: { token: "signed-upload-token" },
    error: null,
  });
  mockCreateSignedUrl.mockResolvedValue({
    data: { signedUrl: "https://signed.invalid/delivery" },
    error: null,
  });
});

describe("Natori delivery Storage", () => {
  it("uses the server admin client to issue a path-scoped signed upload", async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "natori_projects") {
        return {
          select: vi.fn(() =>
            query({ data: { id: "project-1" }, error: null }),
          ),
        };
      }
      if (table === "natori_delivery_files") {
        return {
          select: vi.fn(() =>
            query({ count: 0, data: null, error: null }),
          ),
          insert: mockInsert.mockImplementation(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { id: "file-1" },
                error: null,
              }),
            })),
          })),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await signNatoriDeliveryUpload({
      projectId: "project-1",
      folder: "final",
      fileName: "final.PDF",
      sizeBytes: 1234,
    });

    expect(result).toEqual({
      kind: "ok",
      fileId: "file-1",
      path: expect.stringMatching(
        /^project-1\/final\/[0-9a-f-]+\.pdf$/i,
      ),
      token: "signed-upload-token",
    });
    expect(mockStorageFrom).toHaveBeenCalledWith("natori-deliveries");
    expect(mockCreateSignedUploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^project-1\/final\/[0-9a-f-]+\.pdf$/i),
    );
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: "project-1",
        folder: "final",
        file_name: "final.PDF",
        size_bytes: 1234,
      }),
    );
  });

  it("does not create a file row when signed-upload issuance fails", async () => {
    mockCreateSignedUploadUrl.mockResolvedValueOnce({
      data: null,
      error: { message: "signing failed" },
    });
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "natori_projects") {
        return {
          select: vi.fn(() =>
            query({ data: { id: "project-1" }, error: null }),
          ),
        };
      }
      if (table === "natori_delivery_files") {
        return {
          select: vi.fn(() =>
            query({ count: 0, data: null, error: null }),
          ),
          insert: mockInsert,
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    await expect(
      signNatoriDeliveryUpload({
        projectId: "project-1",
        folder: "rough",
        fileName: "rough.png",
        sizeBytes: 1234,
      }),
    ).resolves.toEqual({ kind: "storage-error" });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("serves private final deliveries through signed download URLs", async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "natori_projects") {
        return {
          select: vi.fn(() =>
            query({
              data: {
                id: "project-1",
                title: "Final",
                client_name: "Client",
                status: "delivered",
                note: null,
                delivery_accepted_at: null,
                delivery_token_expires_at: null,
                payment_confirmed_at: "2026-07-01T00:00:00.000Z",
              },
              error: null,
            }),
          ),
        };
      }
      if (table === "natori_delivery_files") {
        return {
          select: vi.fn(() =>
            query({
              data: [
                {
                  storage_path: "project-1/final/file.pdf",
                  file_name: "file.pdf",
                  size_bytes: 1234,
                },
              ],
              error: null,
            }),
          ),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await getNatoriDeliveryByToken(
      "abcdefghijklmnopqrstuvwx",
    );

    expect(result).toEqual({
      kind: "ok",
      delivery: expect.objectContaining({
        files: [
          {
            fileName: "file.pdf",
            sizeBytes: 1234,
            url: "https://signed.invalid/delivery",
          },
        ],
      }),
    });
    expect(mockStorageFrom).toHaveBeenCalledWith("natori-deliveries");
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      "project-1/final/file.pdf",
      3600,
      { download: "file.pdf" },
    );
  });
});
