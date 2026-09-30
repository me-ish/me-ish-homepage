import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  info: vi.fn(), download: vi.fn(), upload: vi.fn(), remove: vi.fn(),
  getPublicUrl: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: () => ({ storage: { from: () => storage } }),
}));
import { issueEntryUploadGrant } from "../entryUploadGrant";
import { finishEntryUpload } from "../entryUploadService";

const bytes = Buffer.from("synthetic-existing-published-image");
const key = "synthetic-test-only-signing-material-32-bytes";
const input = { mimeType: "image/png" as const, sizeBytes: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("hex") };
const info = { data: { size: bytes.length, contentType: "image/png" }, error: null };
const transient = { data: null, error: {status: 500, statusCode: "500", message: "InternalError"} };

describe("gallery publication readback during a version switch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", key);
    storage.info.mockResolvedValue(info);
    storage.download.mockResolvedValue({data: new Blob([bytes]), error: null});
    storage.remove.mockResolvedValue({error: null});
    storage.getPublicUrl.mockReturnValue({data: {publicUrl: "https://synthetic.invalid/image.png"}});
  });
  afterEach(() => vi.unstubAllEnvs());

  for (const [name, error] of [
    ["local backend 500", transient],
    ["superseded backend version 404", {data: null, error: {status: 400, statusCode: "404", message: "Object not found"}}],
    ["S3 NoSuchKey", {data: null, error: {status: 400, statusCode: "404", message: "NoSuchKey"}}],
  ] as const) {
    it(`re-reads metadata and exact bytes after ${name}, without uploading again`, async () => {
      const {receipt, grant} = issueEntryUploadGrant(input, key);
      storage.download.mockResolvedValueOnce(error);
      const result = await finishEntryUpload(receipt);
      expect(result).toMatchObject({kind: "ok", fileName: grant.fileName});
      expect(storage.info).toHaveBeenCalledTimes(2);
      expect(storage.download).toHaveBeenCalledTimes(2);
      expect(storage.upload).not.toHaveBeenCalled();
      expect(storage.remove).toHaveBeenCalledTimes(1);
    });
  }
  it("rejects changed metadata after a transient failure", async () => {
    storage.download.mockResolvedValueOnce(transient);
    storage.info.mockResolvedValueOnce(info).mockResolvedValueOnce({
      data: {...info.data, size: bytes.length + 1}, error: null,
    });
    expect(await finishEntryUpload(issueEntryUploadGrant(input, key).receipt)).toEqual({kind: "invalid"});
    expect(storage.download).toHaveBeenCalledTimes(1);
    expect(storage.upload).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });
  it("rejects changed MIME after a transient failure", async () => {
    storage.download.mockResolvedValueOnce(transient);
    storage.info.mockResolvedValueOnce(info).mockResolvedValueOnce({
      data: {...info.data, contentType: "image/jpeg"}, error: null,
    });
    expect(await finishEntryUpload(issueEntryUploadGrant(input, key).receipt)).toEqual({kind: "invalid"});
    expect(storage.upload).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });
  it("rejects changed bytes even when metadata still matches", async () => {
    storage.download.mockResolvedValueOnce(transient).mockResolvedValueOnce({
      data: new Blob([Buffer.alloc(bytes.length)]), error: null,
    });
    expect(await finishEntryUpload(issueEntryUploadGrant(input, key).receipt)).toEqual({kind: "invalid"});
    expect(storage.upload).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });
  it("fails closed when the read remains unavailable, with a fixed upper bound", async () => {
    storage.download.mockResolvedValue(transient);
    expect(await finishEntryUpload(issueEntryUploadGrant(input, key).receipt)).toEqual({kind: "storage-error"});
    expect(storage.download).toHaveBeenCalledTimes(3);
    expect(storage.upload).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });
  it("does not retry an authorization rejection", async () => {
    storage.download.mockResolvedValue({data: null, error: {status: 403, statusCode: "403", message: "AccessDenied"}});
    expect(await finishEntryUpload(issueEntryUploadGrant(input, key).receipt)).toEqual({kind: "storage-error"});
    expect(storage.download).toHaveBeenCalledTimes(1);
    expect(storage.upload).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });
  it("never treats a disappeared publication as permission to upload after a read failure", async () => {
    storage.download.mockResolvedValueOnce(transient);
    storage.info.mockResolvedValueOnce(info).mockResolvedValue({
      data: null, error: {status: 400, statusCode: "404", message: "Object not found"},
    });
    expect(await finishEntryUpload(issueEntryUploadGrant(input, key).receipt)).toEqual({kind: "storage-error"});
    expect(storage.upload).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });
});
