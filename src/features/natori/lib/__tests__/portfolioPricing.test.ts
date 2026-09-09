import { describe, expect, it } from "vitest";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import { createPortfolioStructuredPricingConfig } from "@/features/natori/lib/portfolioPricing";

function item(config: ReturnType<typeof createPortfolioStructuredPricingConfig>, id: string) {
  return config.items.find((entry) => entry.id === id);
}

describe("createPortfolioStructuredPricingConfig", () => {
  it("derives self-site structured pricing from the public portfolio prices", () => {
    const config = createPortfolioStructuredPricingConfig(defaultPortfolioContent);

    expect(item(config, "sd")).toMatchObject({ kind: "base", amount: 3000 });
    expect(item(config, "bust_up")).toMatchObject({ kind: "base", amount: 4000 });
    expect(item(config, "waist_up")).toMatchObject({ kind: "base", amount: 6000 });
    expect(item(config, "full_body")).toMatchObject({ kind: "base", amount: 10000 });
    expect(item(config, "mass_production_illustration")).toMatchObject({
      kind: "base",
      amount: 1500,
    });
    expect(item(config, "expression_variation")).toMatchObject({
      kind: "fixed",
      amount: 500,
    });
    expect(item(config, "additional_character")).toMatchObject({
      kind: "percentage",
      rate: 0.7,
    });
    expect(item(config, "detailed_background")).toMatchObject({
      kind: "fixed",
      amount: 3000,
    });
    expect(item(config, "rush_delivery")).toMatchObject({ kind: "fixed", amount: 2000 });
    expect(item(config, "mass_expression_variation")).toMatchObject({
      kind: "fixed",
      amount: 500,
    });
  });

  it("reflects edited public prices without a separate structured preset", () => {
    const content = {
      ...defaultPortfolioContent,
      plans: defaultPortfolioContent.plans.map((plan) =>
        plan.id === "full_body" ? { ...plan, price: "12,000円" } : plan
      ),
      options: defaultPortfolioContent.options.map((option) => {
        if (option.id === "expression_variation") return { ...option, price: "+800円" };
        if (option.id === "additional_character") return { ...option, price: "基本料金の+60%" };
        return option;
      }),
    };

    const config = createPortfolioStructuredPricingConfig(content);
    expect(item(config, "full_body")).toMatchObject({ amount: 12000 });
    expect(item(config, "expression_variation")).toMatchObject({ amount: 800 });
    expect(item(config, "additional_character")).toMatchObject({ rate: 0.6 });
  });

  it("does not guess a known price when the public display is not parseable", () => {
    const content = {
      ...defaultPortfolioContent,
      plans: defaultPortfolioContent.plans.map((plan) =>
        plan.id === "full_body" ? { ...plan, price: "要相談" } : plan
      ),
    };

    const config = createPortfolioStructuredPricingConfig(content);
    expect(item(config, "full_body")).toBeUndefined();
  });
});
