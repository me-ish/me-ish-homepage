// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import PortfolioFooter from "@/features/natori/components/portfolio/PortfolioFooter";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";

afterEach(cleanup);

describe("PortfolioFooter spacing", () => {
  it("removes extra mobile top padding while preserving desktop footer spacing", () => {
    const { container } = render(<PortfolioFooter content={defaultPortfolioContent} />);
    const footer = container.querySelector("footer") as HTMLElement;

    expect(footer.className).toContain("pt-0");
    expect(footer.className).toContain("pb-10");
    expect(footer.className).toContain("md:py-10");
  });
});
