import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ canEdit: vi.fn(), upload: vi.fn() }));
vi.mock("@/features/natori/server/portfolioSiteService", () => ({
  canEditNatoriPortfolio: mocks.canEdit,
  uploadPortfolioImage: mocks.upload,
}));
vi.mock("@/lib/auth/csrf", () => ({ checkCsrf: () => null }));
import { POST } from "../route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.canEdit.mockResolvedValue(true);
});
it("rejects malformed or middleware-truncated multipart before processing an image", async () => {
  const request = {
    formData: vi
      .fn()
      .mockRejectedValue(new Error("Synthetic truncated multipart")),
  } as unknown as Request;
  const response = await POST(request);
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "invalid_multipart" });
  expect(mocks.upload).not.toHaveBeenCalled();
});
it("denies unauthorized requests before consuming even a malformed body", async () => {
  mocks.canEdit.mockResolvedValue(false);
  const formData = vi
    .fn()
    .mockRejectedValue(new Error("Synthetic invalid body"));
  expect((await POST({ formData } as unknown as Request)).status).toBe(401);
  expect(formData).not.toHaveBeenCalled();
});
it("keeps actual Storage failures distinct from malformed input", async () => {
  mocks.upload.mockResolvedValue({ kind: "upload-error" });
  const file = new File([new Uint8Array(1)], "fixture.png", {
      type: "image/png",
    }),
    form = new FormData();
  form.set("file", file);
  const request = { formData: async () => form } as unknown as Request;
  const response = await POST(request);
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "upload_failed" });
});
