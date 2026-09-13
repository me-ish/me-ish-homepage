// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import PortfolioFooter from "@/features/natori/components/portfolio/PortfolioFooter";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";

afterEach(cleanup);

describe("PortfolioFooter", () => {
  it("removes extra mobile top padding while preserving desktop footer spacing", () => {
    const { container } = render(<PortfolioFooter content={defaultPortfolioContent} />);
    const footer = container.querySelector("footer") as HTMLElement;

    expect(footer.className).toContain("pt-0");
    expect(footer.className).toContain("pb-10");
    expect(footer.className).toContain("md:py-10");
  });

  it("full portfolio shows the legal pages", () => {
    render(<PortfolioFooter content={defaultPortfolioContent} variant="full" />);

    expect(screen.getByRole("link", { name: "特定商取引法に基づく表記" }).getAttribute("href")).toBe(
      "/natori/legal/tokushoho"
    );
    expect(screen.getByRole("link", { name: "プライバシーポリシー" }).getAttribute("href")).toBe(
      "/natori/legal/privacy"
    );
    expect(screen.getByRole("link", { name: "ご依頼規約" }).getAttribute("href")).toBe(
      "/natori/legal/terms"
    );
  });

  it("showcase keeps transaction-related legal links out", () => {
    render(<PortfolioFooter content={defaultPortfolioContent} variant="showcase" />);

    expect(screen.queryByRole("link", { name: "特定商取引法に基づく表記" })).toBeNull();
    expect(screen.queryByRole("link", { name: "プライバシーポリシー" })).toBeNull();
    expect(screen.queryByRole("link", { name: "ご依頼規約" })).toBeNull();
    expect(screen.getByText(defaultPortfolioContent.copyright)).toBeTruthy();
  });
});
