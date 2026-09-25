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
  it("shows artwork before description on mobile while keeping the full-variant actions", () => {
    render(
      <PortfolioHero
        content={{
          ...defaultPortfolioContent,
          heroImage: "https://example.com/hero.webp",
        }}
      />
    );

    const hero = document.getElementById("hero") as HTMLElement;
    expect(hero.className).toContain("pb-8");
    expect(hero.className).toContain("pt-12");
    expect(hero.className).toContain("md:pb-20");
    expect(screen.queryByText(defaultPortfolioContent.artistName)).toBeNull();
    expect(screen.getByText(defaultPortfolioContent.roleEn)).toBeTruthy();
    const description = screen.getByText(defaultPortfolioContent.heroDescription);
    expect(description).toBeTruthy();
    expect(screen.queryByText("3,000円～")).toBeNull();
    expect(screen.queryByRole("link", { name: "料金・追加オプションを確認" })).toBeNull();
    expect(screen.queryByText(defaultPortfolioContent.deliveryLead.split("。")[0] + "。")).toBeNull();
    expect(screen.queryByText(/2〜3日以内にメールで/)).toBeNull();
    const heroTitle = screen.getByRole("heading", { level: 1, name: "ナトリのあとりえ" });
    const titleTail = heroTitle.querySelector("span.break-words") as HTMLElement;
    expect(titleTail.textContent).toBe(defaultPortfolioContent.heroTitleTail);
    expect(titleTail.style.color).toBe("rgb(236, 72, 153)");
    expect(titleTail.querySelectorAll("span")).toHaveLength(0);
    const representativeImage = screen.getByRole("img", {
      name: `${defaultPortfolioContent.artistName}の代表作品`,
    });
    expect(representativeImage).toBeTruthy();
    expect(representativeImage.getAttribute("data-priority")).toBe("true");

    const titleBlock = heroTitle.parentElement as HTMLElement;
    const figure = hero.querySelector("figure") as HTMLElement;
    const descriptionBlock = description.parentElement as HTMLElement;
    expect(titleBlock.className).toContain("order-1");
    expect(figure.className).toContain("order-2");
    expect(descriptionBlock.className).toContain("order-3");

    const primaryLink = screen.getByRole("link", { name: "相談・見積もり" });
    expect(primaryLink.getAttribute("href")).toBe("/natori/portfolio/contact");
    expect((primaryLink as HTMLElement).style.background).toBe("rgb(236, 72, 153)");
    expect((primaryLink as HTMLElement).style.borderColor).toBe("rgb(236, 72, 153)");
    expect((primaryLink as HTMLElement).style.color).toBe("rgb(255, 255, 255)");
    expect(primaryLink.className).toContain("border-2");
    expect(primaryLink.className).toContain("rounded-full");
    expect(primaryLink.className).toContain("text-base font-black");
    const worksLink = screen.getByRole("link", { name: "作品を見る" });
    expect(worksLink.getAttribute("href")).toBe("#gallery");
    expect((worksLink as HTMLElement).style.borderColor).toBe("rgb(236, 72, 153)");
    expect(worksLink.className).toContain("rounded-full");

    fireEvent.click(screen.getByRole("link", { name: "相談・見積もり" }));
    expect(trackNatoriPageEvent).toHaveBeenCalledWith(
      "portfolio_primary_cta_click",
      "hero"
    );
  });

  it("supports multiple configured hero images with manual controls", () => {
    render(
      <PortfolioHero
        content={{
          ...defaultPortfolioContent,
          heroImage: "https://example.com/hero-a.webp",
          heroImages: [
            "https://example.com/hero-a.webp",
            "https://example.com/hero-b.webp",
          ],
        }}
      />
    );

    expect(
      screen.getByRole("img", { name: `${defaultPortfolioContent.artistName}の代表作品` })
        .getAttribute("src")
    ).toBe("https://example.com/hero-a.webp");
    expect(screen.getByRole("button", { name: "前の作品" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "次の作品" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "1枚目を表示" }).getAttribute("aria-current")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "次の作品" }));

    expect(
      screen.getByRole("img", { name: `${defaultPortfolioContent.artistName}の代表作品 2` })
        .getAttribute("src")
    ).toBe("https://example.com/hero-b.webp");
    expect(screen.getByRole("button", { name: "2枚目を表示" }).getAttribute("aria-current")).toBe("true");
  });

  it("uses the first real work image when hero images are not configured", () => {
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
          heroImages: [],
          works: [fallbackWork, ...defaultPortfolioContent.works.slice(1)],
        }}
      />
    );

    expect(screen.getByRole("img", { name: fallbackWork.title })).toBeTruthy();
    expect(screen.getByText(fallbackWork.title)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "次の作品" })).toBeNull();
  });

  it("does not invent a decorative visual when no real artwork is configured", () => {
    render(<PortfolioHero content={{ ...defaultPortfolioContent, heroImages: [] }} />);

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
