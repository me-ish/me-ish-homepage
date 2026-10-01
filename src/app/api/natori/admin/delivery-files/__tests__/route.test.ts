import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/features/natori/server/natoriManagementRoute", () => ({
  withNatoriManagement: (_operation: string, _mutation: boolean, handler: unknown) => handler,
}));
vi.mock("@/features/natori/server/requireNatoriAdmin", () => ({ canUseNatoriManagement: vi.fn().mockResolvedValue(true) }));
const sign = vi.hoisted(() => vi.fn());
vi.mock("@/features/natori/server/deliveryService", () => ({
  signNatoriDeliveryUpload: sign, deleteNatoriDeliveryFile: vi.fn(), listNatoriDeliveryFiles: vi.fn(),
}));
vi.mock("@/features/natori/server/deliveryFilesService", () => ({ deliveryIntegrityEnabled: vi.fn(), finalizeDeliveryFile: vi.fn() }));
import { POST } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
  sign.mockResolvedValue({ kind: "ok", fileId: "file-1", path: "fixture/final/file.bin", token: "fixture-token" });
});
function request(folder: string, sizeBytes: number) {
  return new Request("https://example.com/api/natori/admin/delivery-files", { method: "POST",
    headers: { "content-type": "application/json", "x-requested-with": "me-ish" },
    body: JSON.stringify({ projectId: "project-1", folder, fileName: "boundary.bin", sizeBytes }) });
}
describe("delivery upload API limit", () => {
  it.each(["rough", "final"])("accepts exactly 50,000,000 bytes (%s)", async folder => {
    const response = await POST(request(folder, 50_000_000));
    expect(response.status).toBe(200);
    expect(sign).toHaveBeenCalledWith(expect.objectContaining({ folder, sizeBytes: 50_000_000 }));
  });
  it.each(["rough", "final"])("rejects +1 byte before signing (%s)", async folder => {
    const response = await POST(request(folder, 50_000_001));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "ファイルは1つ50MBまでです" });
    expect(sign).not.toHaveBeenCalled();
  });
});
