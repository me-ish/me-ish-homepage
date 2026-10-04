import { describe, expect, it } from "vitest";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import {
  portfolioBrandName,
  portfolioBrandSubName,
  portfolioShareArtwork,
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
