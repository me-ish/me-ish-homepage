import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { defaultPortfolioContent } from "../../constants/portfolioContent";
import {
  NATORI_MANAGEMENT_ASSET_BUCKET,
  portfolioAssetUrl,
} from "../../lib/portfolioAssetUrl";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  info: vi.fn(),
  saved: vi.fn(),
  fetch: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: () => ({
    from: mocks.from,
    storage: { from: () => ({ info: mocks.info }) },
  }),
}));
vi.mock("../natoriOwner", () => ({
  resolveNatoriOwnerId: async () => "00000000-0000-4000-8000-000000000011",
}));
vi.mock("../trustedNatoriOwner", () => ({
  resolveTrustedNatoriOwnerId: () => ({
    kind: "ok",
    ownerId: "00000000-0000-4000-8000-000000000011",
  }),
}));
vi.mock("../portfolioContentStore", () => ({
  readPortfolioSavedState: mocks.saved,
}));
import {
  finalizePrivatePortfolioVideo,
  readPortfolioAsset,
  validatePortfolioAssetReferences,
} from "../portfolioAssetsService";

const id = "00000000-0000-4000-8000-000000000022";
const owner = "00000000-0000-4000-8000-000000000011";
const imageURL = portfolioAssetUrl(id, "image", true);
const content = {
  ...defaultPortfolioContent,
  works: [
    { ...defaultPortfolioContent.works[0], image: imageURL, published: true },
  ],
};
let row: {
  path: string;
  byte_size: number;
  ready: boolean;
  kind?: string;
  id?: string;
};
let updateError: unknown;
function query() {
  let updating = false;
  const chain = {
    select: () => chain,
    eq: (...args: unknown[]) => {
      mocks.eq(...args);
      return chain;
    },
    in: async () => ({ data: row ? [row] : [], error: null }),
    update: () => {
      updating = true;
      return chain;
    },
    maybeSingle: async () => ({
      data: updating ? { id } : row,
      error: updating ? updateError : null,
    }),
  };
  return chain;
}
beforeEach(() => {
  vi.clearAllMocks();
  updateError = null;
  row = {
    id,
    kind: "image",
    path: `portfolio/${owner}/${id}.webp`,
    byte_size: 4,
    ready: true,
  };
  mocks.from.mockImplementation(query);
  mocks.saved.mockResolvedValue({ content, revision: 1 });
  mocks.fetch.mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3, 4]), {
      headers: { "Content-Type": "image/webp", "Content-Length": "4" },
    }),
  );
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:45678");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-unit-only");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("private asset authorization and streaming", () => {
  it("streams the upstream body with no-store and scopes metadata to the trusted owner", async () => {
    const response = await readPortfolioAsset(
      new Request("http://local.invalid"),
      id,
      "image",
      false,
    );
    expect(response?.status).toBe(200);
    expect(response?.headers.get("cache-control")).toContain("no-store");
    expect(await response?.arrayBuffer()).toEqual(
      new Uint8Array([1, 2, 3, 4]).buffer,
    );
    expect(mocks.eq).toHaveBeenCalledWith("owner_id", owner);
    expect(mocks.fetch.mock.calls[0][1]).toMatchObject({
      redirect: "error",
      cache: "no-store",
    });
  });
  it("never fetches an unpublished asset, foreign path, or unfinished upload", async () => {
    mocks.saved.mockResolvedValueOnce({
      content: { ...content, works: [] },
      revision: 2,
    });
    expect(
      await readPortfolioAsset(
        new Request("http://local.invalid"),
        id,
        "image",
        false,
      ),
    ).toBeNull();
    row.path = `portfolio/foreign/${id}.webp`;
    expect(
      await readPortfolioAsset(
        new Request("http://local.invalid"),
        id,
        "image",
        true,
      ),
    ).toBeNull();
    row.path = `portfolio/${owner}/${id}.webp`;
    row.ready = false;
    expect(
      await readPortfolioAsset(
        new Request("http://local.invalid"),
        id,
        "image",
        true,
      ),
    ).toBeNull();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "cancels a fetched body when the second publication check denies or fails (%s)",
    async (fails) => {
      const cancel = vi.fn();
      const upstream = new Response(new ReadableStream({ cancel }), {
        headers: { "Content-Type": "image/webp", "Content-Length": "4" },
      });
      mocks.fetch.mockResolvedValueOnce(upstream);
      mocks.saved.mockResolvedValueOnce({ content, revision: 1 });
      if (fails)
        mocks.saved.mockRejectedValueOnce(
          new Error("Synthetic DB unavailable"),
        );
      else
        mocks.saved.mockResolvedValueOnce({
          content: { ...content, works: [] },
          revision: 2,
        });
      const operation = readPortfolioAsset(
        new Request("http://local.invalid"),
        id,
        "image",
        false,
      );
      if (fails)
        await expect(operation).rejects.toThrow("Synthetic DB unavailable");
      else expect(await operation).toBeNull();
      expect(cancel).toHaveBeenCalledOnce();
    },
  );
  it.each([
    "bytes=0-1,3-4",
    "bytes=9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999-",
  ])("rejects unsupported range %s before Storage", async (range) => {
    expect(
      (
        await readPortfolioAsset(
          new Request("http://local.invalid", { headers: { Range: range } }),
          id,
          "image",
          true,
        )
      )?.status,
    ).toBe(416);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each([
    { "Content-Type": "text/html", "Content-Length": "4" },
    { "Content-Type": "image/webp", "Content-Length": "5" },
  ])("rejects upstream MIME/size drift", async (headers) => {
    mocks.fetch.mockResolvedValueOnce(
      new Response(new Uint8Array([1, 2, 3, 4]), { headers }),
    );
    await expect(
      readPortfolioAsset(
        new Request("http://local.invalid"),
        id,
        "image",
        true,
      ),
    ).rejects.toThrow();
  });
  it("rejects range total/offset drift rather than forwarding mislabeled media", async () => {
    mocks.fetch.mockResolvedValueOnce(
      new Response(new Uint8Array([1, 2]), {
        status: 206,
        headers: {
          "Content-Type": "image/webp",
          "Content-Range": "bytes 1-2/4",
        },
      }),
    );
    await expect(
      readPortfolioAsset(
        new Request("http://local.invalid", {
          headers: { Range: "bytes=0-1" },
        }),
        id,
        "image",
        true,
      ),
    ).rejects.toThrow("range invalid");
  });
  it("validates committed managed references against kind, ownership and ready metadata", async () => {
    expect(await validatePortfolioAssetReferences(content, owner)).toBe(true);
    row.path = `portfolio/foreign/${id}.webp`;
    expect(await validatePortfolioAssetReferences(content, owner)).toBe(false);
    expect(
      await validatePortfolioAssetReferences(
        { ...content, heroImage: portfolioAssetUrl(id, "video", true) },
        owner,
      ),
    ).toBe(false);
  });
});

describe("bounded video verification", () => {
  beforeEach(() => {
    row = {
      path: `portfolio/${owner}/${id}.mp4`,
      byte_size: 50_000_000,
      ready: false,
    };
    mocks.info.mockResolvedValue({
      error: null,
      data: {
        name: row.path,
        bucketId: NATORI_MANAGEMENT_ASSET_BUCKET,
        size: row.byte_size,
        contentType: "video/mp4",
      },
    });
    const header = new Uint8Array(24);
    header.set([0, 0, 0, 32]);
    header.set(new TextEncoder().encode("ftypisom"), 4);
    mocks.fetch.mockResolvedValue(
      new Response(header, {
        status: 206,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Range": "bytes 0-23/50000000",
        },
      }),
    );
  });
  it("checks a 50 MB object via metadata and a 24-byte range only", async () => {
    expect(await finalizePrivatePortfolioVideo(id)).toBe(true);
    expect(mocks.fetch.mock.calls[0][1].headers.Range).toBe("bytes=0-23");
    expect(mocks.eq).toHaveBeenCalledWith("byte_size", 50_000_000);
  });
  it("does not fetch content when metadata size or MIME fails", async () => {
    mocks.info.mockResolvedValue({
      error: null,
      data: {
        name: row.path,
        bucketId: NATORI_MANAGEMENT_ASSET_BUCKET,
        size: 50_000_001,
        contentType: "image/webp",
      },
    });
    expect(await finalizePrivatePortfolioVideo(id)).toBe(false);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("refuses full-body range fallback and never marks an invalid prefix ready", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response("bad", { status: 200 }));
    expect(await finalizePrivatePortfolioVideo(id)).toBe(false);
    mocks.fetch.mockResolvedValueOnce(
      new Response(new Uint8Array(24), {
        status: 206,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Range": "bytes 0-23/50000000",
        },
      }),
    );
    expect(await finalizePrivatePortfolioVideo(id)).toBe(false);
  });
});

it("rejects nonlocal reserved asset references before ownership metadata lookup", async () => {
  expect(
    await validatePortfolioAssetReferences(
      { ...content, heroImage: "https://www.me-ish.art" + imageURL },
      owner,
    ),
  ).toBe(false);
  expect(mocks.from).not.toHaveBeenCalled();
});
