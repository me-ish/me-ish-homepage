import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
const mocks = vi.hoisted(() => ({ upload: vi.fn(), download: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ storage: { from: () => mocks } }) }));
import { prepareIntakeReferenceImage, uploadIntakeReferenceImage } from "../intakeReferenceStorage";
const path = "a1a855ca-9478-4a8d-baa1-123456789abc/b1a855ca-9478-4a8d-baa1-123456789abc.webp";
beforeEach(() => { mocks.upload.mockReset(); mocks.download.mockReset(); });
describe("real image validation and immutable Storage recovery", () => {
  it("converts real PNG to deterministic webp and refuses declared MIME spoofing and arbitrary bytes", async () => {
    const png = await sharp({ create: { width: 3, height: 2, channels: 4, background: "#ec4899" } }).png().toBuffer();
    const result = await prepareIntakeReferenceImage(new File([png], "name.png", { type: "image/png" }));
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") expect((await sharp(result.webp).metadata()).format).toBe("webp");
    expect((await prepareIntakeReferenceImage(new File([png], "name.jpg", { type: "image/jpeg" }))).kind).toBe("invalid");
    expect((await prepareIntakeReferenceImage(new File(["not an image"], "fake.png", { type: "image/png" }))).kind).toBe("invalid");
  });
  it("treats an upload response loss as success only after reading identical bytes at the exact stable path", async () => {
    const bytes = Buffer.from("stable-webp"); mocks.upload.mockResolvedValue({ error: { code: "response_lost" } });
    mocks.download.mockResolvedValue({ data: new Blob([bytes]), error: null });
    expect(await uploadIntakeReferenceImage(path, bytes)).toEqual({ kind: "ok" });
    expect(mocks.upload).toHaveBeenCalledWith(path, bytes, { contentType: "image/webp", upsert: false });
    expect(mocks.download).toHaveBeenCalledWith(path);
  });
  it("fences changed existing bytes for review without overwriting or deleting them", async () => {
    mocks.upload.mockResolvedValue({ error: { code: "409" } }); mocks.download.mockResolvedValue({ data: new Blob(["different"]), error: null });
    expect(await uploadIntakeReferenceImage(path, Buffer.from("expected"))).toEqual({ kind: "mismatch" });
    mocks.download.mockResolvedValue({ data: null, error: { code: "unavailable" } });
    expect(await uploadIntakeReferenceImage(path, Buffer.from("expected"))).toEqual({ kind: "unknown" });
    expect(await uploadIntakeReferenceImage("other-project/file.webp", Buffer.from("expected"))).toEqual({ kind: "unknown" });
    expect(mocks.upload).toHaveBeenCalledTimes(2);
  });
});
