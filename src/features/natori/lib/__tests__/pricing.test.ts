import { describe, expect, it } from "vitest";
import { createDefaultNatoriPricingConfig, createNatoriEstimate, formatYen } from "@/features/natori/lib/pricing";

describe("createNatoriEstimate", () => {
  it("uses the provided base price table", () => {
    expect(createNatoriEstimate("胸上でお願いします。").total).toBe(4000);
    expect(createNatoriEstimate("腰上でお願いします。").total).toBe(6000);
    expect(createNatoriEstimate("全身の立ち絵でお願いします。").total).toBe(10000);
  });

  it("adds fixed options from the provided price list", () => {
    const estimate = createNatoriEstimate("全身で、表情差分と商用利用とお急ぎ納品をお願いします。");

    expect(estimate.category.id).toBe("full_body");
    expect(estimate.breakdown.fixed.map((item) => [item.id, item.amount])).toEqual([
      ["expression_variation", 500],
      ["commercial_use", 3000],
      ["rush_delivery", 2000],
    ]);
    expect(estimate.total).toBe(15500);
  });

  it("does not add commercial use when the request explicitly says it is not needed", () => {
    const estimate = createNatoriEstimate("全身で、表情差分あり。商用利用なしでお願いします。");

    expect(estimate.breakdown.fixed.map((item) => item.id)).toEqual(["expression_variation"]);
    expect(estimate.detectedItems.map((item) => item.id)).not.toContain("commercial_use");
    expect(estimate.total).toBe(10500);
  });

  it("adds an additional character as 70 percent of the base price", () => {
    const estimate = createNatoriEstimate("腰上で2人のペアイラストをお願いします。");

    expect(estimate.category.id).toBe("waist_up");
    expect(estimate.breakdown.percentage).toEqual([
      {
        id: "additional_character",
        label: "人物追加",
        amount: 4200,
        note: "70%加算（基本料金基準）",
      },
    ]);
    expect(estimate.total).toBe(10200);
  });

  it("keeps copyright transfer as a warning without automatic pricing", () => {
    const estimate = createNatoriEstimate("全身イラストの著作権譲渡を希望します。しっかり背景あり。");

    expect(estimate.category.id).toBe("full_body");
    expect(estimate.detectedItems.map((item) => item.id)).toContain("copyright_transfer");
    expect(estimate.total).toBe(13000);
    expect(estimate.warnings).toContain(
      "著作権譲渡は通常料金表の対象外です。利用許諾で足りるかを先に確認してください。"
    );
  });

  it("falls back to bust-up when no base keyword matches", () => {
    const estimate = createNatoriEstimate("かわいい雰囲気の絵をお願いしたいです。");

    expect(estimate.category.id).toBe("bust_up");
    expect(estimate.category.label).toBe("胸上");
    expect(estimate.total).toBe(4000);
  });

  it("uses edited pricing config values", () => {
    const config = createDefaultNatoriPricingConfig();
    config.baseItems = config.baseItems.map((item) =>
      item.id === "bust_up" ? { ...item, basePrice: 4500 } : item
    );
    config.fixedOptions = config.fixedOptions.map((option) =>
      option.id === "commercial_use" ? { ...option, amount: 3500 } : option
    );

    const estimate = createNatoriEstimate("胸上で商用利用したいです。", config);

    expect(estimate.breakdown.base.amount).toBe(4500);
    expect(estimate.breakdown.fixed[0].amount).toBe(3500);
    expect(estimate.total).toBe(8000);
  });
});

describe("formatYen", () => {
  it("formats JPY without decimals", () => {
    expect(formatYen(4000)).toBe("￥4,000");
  });
});
