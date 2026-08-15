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
