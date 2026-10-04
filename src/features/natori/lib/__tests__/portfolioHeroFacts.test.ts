import { describe, expect, it } from "vitest";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import {
  portfolioDeliveryEstimate,
  portfolioHeroFacts,
  portfolioReplyWithin,
  portfolioStartingPlan,
} from "@/features/natori/lib/portfolioHeroFacts";
import type { PortfolioPlan } from "@/features/natori/types/portfolio";

const plan = (price: string, name = "プラン"): PortfolioPlan => ({ id: null, name, price, desc: "", features: [] });

describe("portfolioHeroFacts", () => {
  it("restates the price list, reply copy and delivery lead", () => {
    expect(portfolioHeroFacts(defaultPortfolioContent)).toEqual([
      { label: "SDキャラ", value: "3,000円～" },
      { label: "お返事", value: "2〜3日以内" },
      { label: "納期", value: "約1か月" },
    ]);
  });

  it("leaves out what it cannot read", () => {
    expect(
      portfolioHeroFacts({ plans: [plan("要相談")], deliveryLead: "スケジュールに合わせてご相談します。" }),
    ).toEqual([{ label: "お返事", value: "2〜3日以内" }]);
  });
});

describe("portfolioStartingPlan", () => {
  it("pairs the cheapest single amount with its plan name and ignores unreadable prices", () => {
    expect(
      portfolioStartingPlan([
        plan("10,000円", "全身"),
        plan("4,000円〜", "胸上"),
        plan("応相談", "SD"),
        plan("3,000〜5,000円", "おまかせ"),
      ]),
    ).toEqual({ label: "胸上", value: "4,000円～" });
  });

  it("falls back to a generic label and returns null without a readable price", () => {
    expect(portfolioStartingPlan([plan("5,000円", " ")])).toEqual({ label: "料金", value: "5,000円～" });
    expect(portfolioStartingPlan([])).toBeNull();
    expect(portfolioStartingPlan([plan("0円"), plan("無料")])).toBeNull();
  });
});

describe("portfolioReplyWithin", () => {
  it("reads the reply time from the reception copy", () => {
    expect(portfolioReplyWithin()).toBe("2〜3日以内");
    expect(portfolioReplyWithin("3日以内にご連絡します。")).toBe("3日以内");
    expect(portfolioReplyWithin("順番にお返事します。")).toBeNull();
  });
});

describe("portfolioDeliveryEstimate", () => {
  it("returns the first period in the delivery lead", () => {
    expect(portfolioDeliveryEstimate(defaultPortfolioContent.deliveryLead)).toBe("約1か月");
    expect(portfolioDeliveryEstimate("通常1〜2ヶ月ほどお時間をいただきます。")).toBe("1〜2ヶ月");
    expect(portfolioDeliveryEstimate("ご入金から2週間が目安です。")).toBe("2週間");
    expect(portfolioDeliveryEstimate("")).toBeNull();
  });
});
