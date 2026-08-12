// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../portfolioFonts", () => ({ fontEnStyle: {} }));

import PortfolioHero from "@/features/natori/components/portfolio/PortfolioHero";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";

afterEach(cleanup);

describe("PF-03 portfolio hero", () => {
  it("shows purpose, representative artwork, and the two full-variant actions without repeating the header name", () => {
    render(
      <PortfolioHero
        content={{
          ...defaultPortfolioContent,
          heroImage: "https://example.com/hero.webp",
        }}
      />
    );

    expect(screen.queryByText(defaultPortfolioContent.artistName)).toBeNull();
    expect(screen.getByText(defaultPortfolioContent.roleEn)).toBeTruthy();
    expect(screen.getByText(defaultPortfolioContent.heroDescription)).toBeTruthy();
    expect(
      screen.getByRole("img", { name: `${defaultPortfolioContent.artistName}の代表作品` })
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "相談・見積もり" }).getAttribute("href")).toBe(
      "#form"
    );
    expect(screen.getByRole("link", { name: "作品を見る" }).getAttribute("href")).toBe(
      "#gallery"
    );
  });

  it("uses the first real work image when heroImage is not configured", () => {
    const fallbackWork = {
      ...defaultPortfolioContent.works[0],
      title: "代表作品テスト",
      image: "https://example.com/work.webp",
    };

    render(
      <PortfolioHero
        content={{
          ...defaultPortfolioContent,
          heroImage: null,
          works: [fallbackWork, ...defaultPortfolioContent.works.slice(1)],
        }}
      />
    );

    expect(screen.getByRole("img", { name: fallbackWork.title })).toBeTruthy();
    expect(screen.getByText(fallbackWork.title)).toBeTruthy();
  });

  it("does not invent a decorative visual when no real artwork is configured", () => {
    render(<PortfolioHero content={defaultPortfolioContent} />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(document.querySelector("svg")).toBeNull();
  });

  it("keeps the showcase hero free of direct transaction actions", () => {
    render(
      <PortfolioHero
        content={{
          ...defaultPortfolioContent,
          heroImage: "https://example.com/hero.webp",
        }}
        variant="showcase"
      />
    );

    expect(screen.queryByRole("link", { name: "相談・見積もり" })).toBeNull();
    expect(screen.getByRole("link", { name: "作品を見る" }).getAttribute("href")).toBe(
      "#gallery"
    );
  });
});
