// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/natori/data/pageEvents", () => ({
  trackNatoriPageEvent: vi.fn(),
}));

import PortfolioPricing from "@/features/natori/components/portfolio/PortfolioPricing";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";

describe("PortfolioPricing mobile details", () => {
  it("shows each plan description and only plan-specific features in the mobile list", () => {
    const firstPlan = defaultPortfolioContent.plans[0];
    const planSpecificFeature = "表情差分1点込み";

    render(
      <PortfolioPricing
        content={{
          ...defaultPortfolioContent,
          plans: [
            {
              ...firstPlan,
              features: [...firstPlan.features, planSpecificFeature],
            },
            ...defaultPortfolioContent.plans.slice(1),
          ],
        }}
      />
    );

    const mobileList = screen.getByRole("list", { name: "通常イラスト料金（スマホ）" });

    for (const plan of defaultPortfolioContent.plans) {
      expect(within(mobileList).getByText(plan.desc)).toBeTruthy();
      expect(within(mobileList).getByRole("link", { name: `${plan.name}を選ぶ` })).toBeTruthy();
    }

    expect(within(mobileList).getByText(planSpecificFeature)).toBeTruthy();
    expect(within(mobileList).queryByText("リテイク2回まで無料")).toBeNull();
    expect(within(mobileList).queryByText("簡単な小物・簡易背景無料")).toBeNull();

    expect(screen.getByText(/表示価格には、リテイク2回まで、簡単な小物・簡易背景が含まれます/)).toBeTruthy();
  });
});
