// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const trackNatoriPageEvent = vi.hoisted(() => vi.fn());
vi.mock("@/features/natori/data/pageEvents", () => ({ trackNatoriPageEvent }));

import PortfolioMobileCta from "@/features/natori/components/portfolio/PortfolioMobileCta";

beforeEach(() => vi.stubGlobal("IntersectionObserver", undefined));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("PortfolioMobileCta analytics", () => {
  it("records the sticky mobile CTA source", () => {
    render(<PortfolioMobileCta />);

    const cta = screen.getByRole("link", { name: "相談・見積もり" });
    expect(cta.className).toContain("text-base font-black");
    expect(cta.className).toContain("border-2");
    expect(cta.style.background).toBe("rgb(248, 195, 208)");
    expect(cta.style.borderColor).toBe("rgb(180, 90, 115)");
    expect(cta.style.color).toBe("rgb(122, 51, 74)");
    fireEvent.click(cta);
    expect(trackNatoriPageEvent).toHaveBeenCalledWith(
      "portfolio_primary_cta_click",
      "mobile_sticky"
    );
  });
});
