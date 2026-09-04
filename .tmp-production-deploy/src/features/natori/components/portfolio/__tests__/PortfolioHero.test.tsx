// @vitest-environment jsdom
import type { ImgHTMLAttributes } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../portfolioFonts", () => ({ fontEnStyle: {} }));
const trackNatoriPageEvent = vi.hoisted(() => vi.fn());
vi.mock("@/features/natori/data/pageEvents", () => ({ trackNatoriPageEvent }));
vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority,
    alt = "",
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => (
    // next/image の priority prop を検証するためのテスト専用 mock。
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={alt} data-priority={priority ? "true" : undefined} />
  ),
}));

import PortfolioHero from "@/features/natori/components/portfolio/PortfolioHero";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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
    expect(screen.getByText(defaultPortfolioContent.heroDescription.split("。")[0] + "。")).toBeTruthy();
    expect(screen.getByText("3,000円～")).toBeTruthy();
    expect(screen.getByText(defaultPortfolioContent.deliveryLead.split("。")[0] + "。")).toBeTruthy();
    expect(screen.getByText(/2〜3日以内にメールで/)).toBeTruthy();
    const heroTitle = screen.getByRole("heading", { level: 1, name: "ナトリのあとりえ" });
    const titleTail = heroTitle.querySelector("span.break-words") as HTMLElement;
    expect(titleTail.textContent).toBe(defaultPortfolioContent.heroTitleTail);
    expect(titleTail.style.color).toBe("rgb(230, 106, 169)");
    expect(titleTail.querySelectorAll("span")).toHaveLength(0);
    const representativeImage = screen.getByRole("img", {
      name: `${defaultPortfolioContent.artistName}の代表作品`,
    });
    expect(representativeImage).toBeTruthy();
    expect(representativeImage.getAttribute("data-priority")).toBe("true");
    const primaryLink = screen.getByRole("link", { name: "相談・見積もり" });
    expect(primaryLink.getAttribute("href")).toBe("#form");
    expect((primaryLink as HTMLElement).style.background).toBe("rgb(230, 106, 169)");
    expect((primaryLink as HTMLElement).style.borderColor).toBe("rgb(201, 75, 137)");
    expect((primaryLink as HTMLElement).style.color).toBe("rgb(255, 255, 255)");
    expect(primaryLink.className).toContain("border-2");
    expect(primaryLink.className).toContain("text-base font-black");
    const worksLink = screen.getByRole("link", { name: "作品を見る" });
    expect(worksLink.getAttribute("href")).toBe("#gallery");
    expect((worksLink as HTMLElement).style.borderColor).toBe("rgb(201, 75, 137)");

    fireEvent.click(screen.getByRole("link", { name: "相談・見積もり" }));
    expect(trackNatoriPageEvent).toHaveBeenCalledWith(
      "portfolio_primary_cta_click",
      "hero"
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
    expect(screen.queryByText("納期の目安")).toBeNull();
    expect(screen.queryByText("3,000円～")).toBeNull();
    expect(screen.getByRole("link", { name: "作品を見る" }).getAttribute("href")).toBe(
      "#gallery"
    );
  });
});
