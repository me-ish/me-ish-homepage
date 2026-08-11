// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../PortfolioAbout", () => ({
  default: () => <section id="about" data-section="about"><h2>プロフィール</h2></section>,
}));
vi.mock("../PortfolioCommissionForm", () => ({
  default: () => <section id="form" data-section="form"><h2>相談・見積もり</h2></section>,
}));
vi.mock("../PortfolioFooter", () => ({
  default: () => <footer data-section="footer" />,
}));
vi.mock("../PortfolioGallery", () => ({
  default: () => <section id="gallery" data-section="gallery"><h2>作品</h2></section>,
}));
vi.mock("../PortfolioGuidelines", () => ({
  default: () => <section id="requests" data-section="guidelines"><h2>購入者へのお願い</h2></section>,
}));
vi.mock("../PortfolioHero", () => ({
  default: () => <section data-section="hero"><h1>ナトリのあとりえ</h1></section>,
}));
vi.mock("../PortfolioMobileCta", () => ({
  default: () => <aside data-section="mobile-cta" />,
}));
vi.mock("../PortfolioPricing", () => ({
  default: () => <section id="pricing" data-section="pricing"><h2>料金・ご依頼</h2></section>,
}));
vi.mock("../PortfolioStyles", () => ({ default: () => null }));
vi.mock("../PortfolioWorkflow", () => ({
  default: () => <section id="flow" data-section="workflow"><h2>制作の流れ</h2></section>,
}));
vi.mock("../portfolioFonts", () => ({
  fontEnStyle: {},
  portfolioFontEn: { className: "", variable: "" },
  portfolioFontJp: { className: "", variable: "" },
}));

import PortfolioLanding from "@/features/natori/components/portfolio/PortfolioLanding";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";

afterEach(cleanup);

function sectionOrder(): string[] {
  return Array.from(document.querySelectorAll("[data-section]"), (element) =>
    element.getAttribute("data-section") ?? ""
  );
}

function uniqueNavLinks(): Array<{ href: string; label: string }> {
  const links = screen.getAllByRole("link").map((link) => ({
    href: link.getAttribute("href") ?? "",
    label: link.textContent ?? "",
  }));
  return links.filter(
    (link, index) => links.findIndex((item) => item.href === link.href) === index
  );
}

describe("PF-01 portfolio information architecture", () => {
  it("orders the full variant by decision flow and keeps every nav anchor valid", () => {
    render(<PortfolioLanding content={defaultPortfolioContent} structuredIntake />);

    expect(sectionOrder()).toEqual([
      "hero",
      "gallery",
      "pricing",
      "workflow",
      "about",
      "guidelines",
      "form",
      "mobile-cta",
      "footer",
    ]);
    expect(uniqueNavLinks()).toEqual([
      { href: "#gallery", label: "作品" },
      { href: "#pricing", label: "料金・ご依頼" },
      { href: "#flow", label: "制作の流れ" },
      { href: "#about", label: "プロフィール" },
      { href: "#form", label: "相談・見積もり" },
    ]);
    for (const { href } of uniqueNavLinks()) {
      expect(document.querySelector(href)).not.toBeNull();
    }

    const headingLevels = screen
      .getAllByRole("heading")
      .map((heading) => Number(heading.tagName.slice(1)));
    expect(headingLevels).toEqual([1, 2, 2, 2, 2, 2, 2]);
  });

  it("keeps showcase limited to works and profile", () => {
    render(<PortfolioLanding content={defaultPortfolioContent} variant="showcase" />);

    expect(sectionOrder()).toEqual(["hero", "gallery", "about", "footer"]);
    expect(uniqueNavLinks()).toEqual([
      { href: "#gallery", label: "作品" },
      { href: "#about", label: "プロフィール" },
    ]);
    for (const { href } of uniqueNavLinks()) {
      expect(document.querySelector(href)).not.toBeNull();
    }
    expect(document.querySelector("#pricing")).toBeNull();
    expect(document.querySelector("#flow")).toBeNull();
    expect(document.querySelector("#form")).toBeNull();
  });
});
