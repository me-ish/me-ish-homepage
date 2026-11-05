// 品目に結んだ作品は、品目の「公開してよい日」まで公開ページに出ない（画像も含めて）。
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  content: null as unknown,
  publication: new Map() as Map<string, { publicationPolicy: string; publicationAllowedFrom: string | null }> | null,
  asked: [] as string[][],
}));
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: () => ({
    from: () => {
      const builder = { select: () => builder, eq: () => builder, maybeSingle: () => Promise.resolve({ data: { content: state.content }, error: null }) };
      return builder;
    },
  }),
}));
vi.mock("../caseItemsService", () => ({
  readCaseItemPublication: async (ids: string[]) => { state.asked.push(ids); return state.publication; },
}));
vi.mock("../caseSystemHold", () => ({ assertCaseSystemAdmission: vi.fn() }));
vi.mock("../requireNatoriAdmin", () => ({ canUseNatoriManagement: async () => false }));
vi.mock("../natoriOwner", () => ({ resolveNatoriOwnerId: async () => null }));
vi.mock("../portfolioContentStore", () => ({ readPortfolioSavedState: vi.fn() }));

import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import { loadPortfolioContent } from "../portfolioSiteService";

const ITEM = "11111111-1111-4111-8111-111111111111";
const work = (id: string, caseItemId?: string) => ({
  id, title: id, tags: [], image: null, collectionId: null, featured: false, published: true, ...(caseItemId ? { caseItemId } : {}),
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-12-25T14:59:00Z")); // 日本時間 12/25 23:59
  state.asked = [];
  state.content = { ...defaultPortfolioContent, works: [work("free"), work("xmas", ITEM)] };
});

describe("loadPortfolioContent and case items", () => {
  it("hides a work linked to an item until its allowed date in Japan time", async () => {
    state.publication = new Map([[ITEM, { publicationPolicy: "delayed", publicationAllowedFrom: "2026-12-26" }]]);
    expect((await loadPortfolioContent()).works.map((w) => w.id)).toEqual(["free"]);
    expect(state.asked).toEqual([[ITEM]]);
    vi.setSystemTime(new Date("2026-12-25T15:00:00Z")); // 日本時間 12/26 0:00
    expect((await loadPortfolioContent()).works.map((w) => w.id)).toEqual(["free", "xmas"]);
  });

  it("keeps linked works out when items cannot be read or are gone", async () => {
    state.publication = null;
    expect((await loadPortfolioContent()).works.map((w) => w.id)).toEqual(["free"]);
    state.publication = new Map();
    expect((await loadPortfolioContent()).works.map((w) => w.id)).toEqual(["free"]);
  });

  it("does not read items when no published work is linked", async () => {
    state.content = { ...defaultPortfolioContent, works: [work("free")] };
    await loadPortfolioContent();
    expect(state.asked).toEqual([]);
  });
});

describe("saved content keeps the link", () => {
  it("parses caseItemId and drops a broken one", async () => {
    const { parsePortfolioContent } = await import("@/features/natori/lib/portfolioContent");
    const parsed = parsePortfolioContent({ ...defaultPortfolioContent, works: [work("xmas", ITEM), work("free")] });
    expect(parsed?.works.map((w) => w.caseItemId)).toEqual([ITEM, undefined]);
    expect(parsePortfolioContent({ ...defaultPortfolioContent, works: [work("bad", "not-a-uuid")] })).toBeNull();
  });
  it("never sends the link to public pages", async () => {
    state.publication = new Map([[ITEM, { publicationPolicy: "allowed", publicationAllowedFrom: null }]]);
    const xmas = (await loadPortfolioContent()).works.find((w) => w.id === "xmas");
    expect(xmas && "caseItemId" in xmas).toBe(false);
  });
});
