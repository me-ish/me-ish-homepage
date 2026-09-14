// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/natori/data/pageEvents", () => ({
  trackNatoriPageEvent: vi.fn(),
}));

import PortfolioPricing from "@/features/natori/components/portfolio/PortfolioPricing";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";

describe("PortfolioPricing mobile details", () => {
  it("keeps plan descriptions while using compact mobile rows", () => {
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
    const rows = within(mobileList).getAllByRole("listitem").filter((item) =>
      item.parentElement === mobileList
    );

    expect(rows).toHaveLength(defaultPortfolioContent.plans.length);

    for (const plan of defaultPortfolioContent.plans) {
      expect(within(mobileList).getByText(plan.desc)).toBeTruthy();
      const cta = within(mobileList).getByRole("link", { name: `${plan.name}を選ぶ` });
      expect(cta.textContent).toBe("このプランで相談");
      expect(cta.className).toContain("rounded-full");
      expect(cta.className).toContain("min-h-[32px]");
    }

    expect(rows[0].className).toContain("py-2");
    expect(within(mobileList).getByText(planSpecificFeature)).toBeTruthy();
    expect(within(mobileList).queryByText("リテイク2回まで無料")).toBeNull();
    expect(within(mobileList).queryByText("簡単な小物・簡易背景無料")).toBeNull();

    const commonNote = screen.getByText("通常イラスト共通").parentElement as HTMLElement;
    expect(commonNote.className).toContain("py-2");
    expect(
      screen.getByText(/表示価格には、リテイク2回まで、簡単な小物・簡易背景が含まれます/)
    ).toBeTruthy();
  });
});
