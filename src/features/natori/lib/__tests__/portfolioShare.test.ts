import { describe, expect, it } from "vitest";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import {
  portfolioBrandName,
  portfolioBrandSubName,
  portfolioShareArtwork,
  portfolioShareTitle,
  resolvePortfolioShareImageUrl,
} from "@/features/natori/lib/portfolioShare";
import type { PortfolioWork } from "@/features/natori/types/portfolio";

const work = (overrides: Partial<PortfolioWork>): PortfolioWork => ({
  id: "w",
  title: "作品",
  tags: [],
  image: null,
  collectionId: null,
  featured: false,
  published: true,
  ...overrides,
});

describe("portfolioBrandName", () => {
  it("joins the two parts of the hero title", () => {
    expect(portfolioBrandName(defaultPortfolioContent)).toBe("ナトリのあとりえ");
  });

  it("falls back to the site name when the hero title is empty", () => {
    expect(
      portfolioBrandName({ heroTitleAccent: " ", heroTitleTail: "", artistName: "Atelier Natori" }),
    ).toBe("Atelier Natori");
  });
});

describe("portfolioBrandSubName", () => {
  it("returns the site name when it differs from the brand name", () => {
    expect(
      portfolioBrandSubName({ heroTitleAccent: "ナトリの", heroTitleTail: "あとりえ", artistName: "Atelier Natori" }),
    ).toBe("Atelier Natori");
  });

  it("returns null when there is nothing extra to show", () => {
    expect(portfolioBrandSubName({ heroTitleAccent: "", heroTitleTail: "", artistName: "Atelier Natori" })).toBeNull();
    expect(portfolioBrandSubName({ heroTitleAccent: "ナトリの", heroTitleTail: "あとりえ", artistName: " " })).toBeNull();
  });
});

describe("portfolioShareTitle", () => {
  it("keeps the two parts of the hero title apart so they can be colored differently", () => {
    expect(portfolioShareTitle(defaultPortfolioContent)).toEqual({ accent: "ナトリの", tail: "あとりえ" });
    expect(
      portfolioShareTitle({ heroTitleAccent: " ナトリの ", heroTitleTail: "", artistName: "Atelier Natori" }),
    ).toEqual({ accent: "ナトリの", tail: "" });
  });

  it("falls back to the site name when both parts of the hero title are blank", () => {
    expect(
      portfolioShareTitle({ heroTitleAccent: " ", heroTitleTail: "", artistName: " Atelier Natori " }),
    ).toEqual({ accent: "Atelier Natori", tail: "" });
  });
});

describe("resolvePortfolioShareImageUrl", () => {
  const site = "https://www.example.com";

  it("keeps https URLs as they are", () => {
    expect(resolvePortfolioShareImageUrl("https://cdn.example.net/a.webp?x=1", site, false)?.href).toBe(
      "https://cdn.example.net/a.webp?x=1",
    );
  });

  it("resolves a root-relative path against the site", () => {
    expect(resolvePortfolioShareImageUrl("/phase7-art/work-1.svg", site, false)?.href).toBe(
      "https://www.example.com/phase7-art/work-1.svg",
    );
    // サイトのURLに階層が付いていても、サイト直下から解決する
    expect(resolvePortfolioShareImageUrl("/a.webp", "https://www.example.com/natori", false)?.href).toBe(
      "https://www.example.com/a.webp",
    );
  });

  it("allows http only while developing", () => {
    expect(resolvePortfolioShareImageUrl("http://localhost:3000/a.png", site, false)).toBeNull();
    expect(resolvePortfolioShareImageUrl("http://localhost:3000/a.png", site, true)?.href).toBe(
      "http://localhost:3000/a.png",
    );
    // 開発中の既定の siteUrl（http）でも、相対パスは同じ規則で取り込める
    expect(resolvePortfolioShareImageUrl("/a.png", "http://localhost:3000", true)?.href).toBe("http://localhost:3000/a.png");
    expect(resolvePortfolioShareImageUrl("/a.png", "http://localhost:3000", false)).toBeNull();
  });

  it("refuses other schemes and values it cannot read", () => {
    expect(resolvePortfolioShareImageUrl("data:image/png;base64,AAAA", site, true)).toBeNull();
    expect(resolvePortfolioShareImageUrl("javascript:alert(1)", site, true)).toBeNull();
    expect(resolvePortfolioShareImageUrl("file:///etc/passwd", site, true)).toBeNull();
    // サイトのURLが壊れていても、https の絶対URLは取り込め、相対パスだけが null になる
    expect(resolvePortfolioShareImageUrl("https://cdn.example.net/a.webp", "not a url", false)?.href).toBe(
      "https://cdn.example.net/a.webp",
    );
    expect(resolvePortfolioShareImageUrl("/a.webp", "not a url", false)).toBeNull();
  });
});

describe("portfolioShareArtwork", () => {
  it("uses the first slide", () => {
    expect(
      portfolioShareArtwork({ heroImages: ["", "https://example.com/a.webp"], heroImage: null, works: [] }),
    ).toBe("https://example.com/a.webp");
  });

  it("falls back to the legacy hero image, then the first published work with an image", () => {
    expect(portfolioShareArtwork({ heroImages: [], heroImage: "https://example.com/h.webp", works: [] })).toBe(
      "https://example.com/h.webp",
    );
    expect(
      portfolioShareArtwork({
        heroImages: [],
        heroImage: null,
        works: [
          work({ id: "hidden", image: "https://example.com/hidden.webp", published: false }),
          work({ id: "empty" }),
          work({ id: "shown", image: "https://example.com/shown.webp" }),
        ],
      }),
    ).toBe("https://example.com/shown.webp");
  });

  it("returns null when there is no artwork", () => {
    expect(portfolioShareArtwork({ heroImages: undefined, heroImage: null, works: [work({})] })).toBeNull();
  });
});
