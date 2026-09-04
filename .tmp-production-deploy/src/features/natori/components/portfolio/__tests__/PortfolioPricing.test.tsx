// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const trackNatoriPageEvent = vi.hoisted(() => vi.fn());
vi.mock("@/features/natori/data/pageEvents", () => ({ trackNatoriPageEvent }));

import PortfolioPricing from "@/features/natori/components/portfolio/PortfolioPricing";
import {
  PLAN_SELECT_EVENT,
  defaultPortfolioContent,
} from "@/features/natori/constants/portfolioContent";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PortfolioPricing analytics", () => {
  it("shows each fixed plan price as a starting price without altering ranges", () => {
    render(
      <PortfolioPricing
        content={{
          ...defaultPortfolioContent,
          plans: [
            ...defaultPortfolioContent.plans.slice(0, 2),
            { ...defaultPortfolioContent.plans[2], price: "6,000円〜8,000円" },
            { ...defaultPortfolioContent.plans[3], price: "応相談" },
          ],
        }}
      />
    );

    expect(screen.getByText("3,000円～")).toBeTruthy();
    expect(screen.getByText("4,000円～")).toBeTruthy();
    expect(screen.getByText("6,000円〜8,000円")).toBeTruthy();
    expect(screen.getByText("応相談")).toBeTruthy();
  });

  it("does not draw a border around the common plan note", () => {
    render(<PortfolioPricing content={defaultPortfolioContent} />);

    const commonNote = screen.getByText("全プラン共通").parentElement as HTMLElement;
    expect(commonNote.className.split(/\s+/)).not.toContain("border");
    expect(commonNote.style.borderColor).toBe("");
  });

  it("records both the pricing CTA and selected public plan name", () => {
    const planEvent = vi.fn();
    window.addEventListener(PLAN_SELECT_EVENT, planEvent);
    render(<PortfolioPricing content={defaultPortfolioContent} />);

    const firstPlan = defaultPortfolioContent.plans[0];
    fireEvent.click(screen.getAllByRole("link", { name: "このプランで相談" })[0]);

    expect(trackNatoriPageEvent).toHaveBeenNthCalledWith(
      1,
      "portfolio_primary_cta_click",
      "pricing"
    );
    expect(trackNatoriPageEvent).toHaveBeenNthCalledWith(
      2,
      "portfolio_plan_click",
      firstPlan.name
    );
    expect(planEvent).toHaveBeenCalledOnce();
    window.removeEventListener(PLAN_SELECT_EVENT, planEvent);
  });
});
