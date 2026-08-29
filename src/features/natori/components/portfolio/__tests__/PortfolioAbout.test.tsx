// @vitest-environment jsdom
import type { ImgHTMLAttributes } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../portfolioFonts", () => ({ fontEnStyle: {} }));
vi.mock("@/features/natori/data/pageEvents", () => ({ trackNatoriPageEvent: vi.fn() }));
vi.mock("next/image", () => ({
  default: ({ alt = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={alt} />
  ),
}));

import PortfolioAbout from "@/features/natori/components/portfolio/PortfolioAbout";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";

afterEach(cleanup);

describe("PortfolioAbout profile identity", () => {
  it("shows the profile name without the role and uses a vivid orange X link", () => {
    render(
      <PortfolioAbout
        content={{
          ...defaultPortfolioContent,
          profileName: "ナトリ",
          profileRole: "Illustrator",
        }}
        flatPlaceholders
      />
    );

    expect(screen.getByText("ナトリ")).toBeTruthy();
    expect(screen.queryByText("Illustrator")).toBeNull();

    const xLink = screen.getByRole("link", { name: "@natonato_o" });
    expect(xLink.className).toContain("font-black");
    expect(xLink.style.background).toBe("rgb(255, 215, 163)");
    expect(xLink.style.borderColor).toBe("rgb(138, 72, 0)");
    expect(xLink.style.color).toBe("rgb(138, 72, 0)");
  });
});
