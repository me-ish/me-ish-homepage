import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  project: vi.fn(),
  download: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../natoriOwner", () => ({
  resolveNatoriOwnerId: async () => "fixture-owner",
}));
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: () => ({
    from: () => {
      const chain = {
        select: () => chain,
        eq: (...args: unknown[]) => {
          mocks.eq(...args);
          return chain;
        },
        maybeSingle: mocks.project,
      };
      return chain;
    },
    storage: { from: () => ({ download: mocks.download }) },
  }),
}));
import { readNatoriProjectThumb } from "../projectThumbsService";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.project.mockResolvedValue({
    data: { id: "fixture-project" },
    error: null,
  });
  mocks.download.mockResolvedValue({
    data: new Blob(["fixture"]),
    error: null,
  });
});
afterEach(() => vi.restoreAllMocks());
it("does not download a foreign or absent project even when an object exists", async () => {
  mocks.project.mockResolvedValueOnce({ data: null, error: null });
  expect(await readNatoriProjectThumb("fixture-project")).toBeNull();
  expect(mocks.download).not.toHaveBeenCalled();
  expect(mocks.eq).toHaveBeenCalledWith("user_id", "fixture-owner");
});
it("rechecks target ownership after Storage returns so a reassignment cannot release bytes", async () => {
  mocks.project
    .mockResolvedValueOnce({ data: { id: "fixture-project" }, error: null })
    .mockResolvedValueOnce({ data: null, error: null });
  expect(await readNatoriProjectThumb("fixture-project")).toBeNull();
  expect(mocks.project).toHaveBeenCalledTimes(2);
});
it("uses authenticated legacy compatibility only on an actual not-found, and rechecks its ownership", async () => {
  mocks.download.mockResolvedValueOnce({
    error: { statusCode: "404" },
    data: null,
  });
  mocks.project
    .mockResolvedValueOnce({ data: { id: "fixture-project" }, error: null })
    .mockResolvedValueOnce({ data: null, error: null });
  expect(await readNatoriProjectThumb("fixture-project")).toBeNull();
  expect(mocks.download).toHaveBeenCalledTimes(2);
});
it("fails closed on Storage errors and on a failed ownership recheck", async () => {
  mocks.download.mockResolvedValueOnce({
    error: { statusCode: "503" },
    data: null,
  });
  await expect(readNatoriProjectThumb("fixture-project")).rejects.toThrow(
    "download unavailable",
  );
  expect(mocks.download).toHaveBeenCalledTimes(1);
  mocks.project
    .mockResolvedValueOnce({ data: { id: "fixture-project" }, error: null })
    .mockResolvedValueOnce({ data: null, error: {} });
  await expect(readNatoriProjectThumb("fixture-project")).rejects.toThrow(
    "authorization unavailable",
  );
});
