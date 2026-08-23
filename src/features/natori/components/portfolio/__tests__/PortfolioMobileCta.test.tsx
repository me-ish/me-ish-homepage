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
    expect(cta.style.background).toBe("rgb(213, 46, 113)");
    expect(cta.style.color).toBe("rgb(255, 255, 255)");
    fireEvent.click(cta);
    expect(trackNatoriPageEvent).toHaveBeenCalledWith(
      "portfolio_primary_cta_click",
      "mobile_sticky"
    );
  });
});
