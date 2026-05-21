import { describe, expect, it } from "vitest";
import { createDefaultNatoriPricingConfig, createNatoriEstimate, formatYen } from "@/lib/natori/pricing";

describe("createNatoriEstimate", () => {
  it("keeps copyright transfer as a warning without automatic pricing", () => {
    const estimate = createNatoriEstimate("立ち絵の著作権譲渡を希望します。背景あり。");

    expect(estimate.category.id).toBe("standing");
    expect(estimate.detectedItems.map((item) => item.id)).toContain("copyright_transfer");
    expect(estimate.total).toBe(38000);
    expect(estimate.breakdown.fixed).toHaveLength(1);
    expect(estimate.breakdown.percentage).toHaveLength(0);
    expect(estimate.warnings).toContain(
      "著作権譲渡は通常料金表の対象外です。利用許諾で足りるかを先に確認してください。"
    );
  });

  it("adds commercial use as a percentage option", () => {
    const estimate = createNatoriEstimate("アイコンを商用利用で販売ページに使いたいです。");

    expect(estimate.category.id).toBe("icon");
    expect(estimate.breakdown.base.amount).toBe(8000);
    expect(estimate.breakdown.percentage).toEqual([
      {
        id: "commercial_use",
        label: "商用利用",
        amount: 4000,
        note: "50%加算",
      },
    ]);
    expect(estimate.total).toBe(12000);
  });

  it("calculates the correct total with multiple options", () => {
    const estimate = createNatoriEstimate(
      "SDキャラをお願いします。表情差分あり、背景あり、商用利用でグッズ販売予定です。急ぎです。"
    );

    expect(estimate.category.id).toBe("sd_character");
    expect(estimate.subtotalBeforePercentage).toBe(26000);
    expect(estimate.breakdown.fixed.map((item) => item.id)).toEqual([
      "expression_variation",
      "background",
    ]);
    expect(estimate.breakdown.percentage.map((item) => item.id)).toEqual([
      "commercial_use",
      "rush",
    ]);
    expect(estimate.total).toBe(46800);
    expect(estimate.warnings).toContain("短納期はスケジュール確認後に追加料金またはお断りの判断が必要です。");
  });

  it("falls back to general illustration when no base keyword matches", () => {
    const estimate = createNatoriEstimate("かわいい雰囲気の絵をお願いしたいです。");

    expect(estimate.category.id).toBe("general");
    expect(estimate.category.label).toBe("通常イラスト");
    expect(estimate.total).toBe(20000);
  });

  it("includes estimate caveats and questions in the reply draft", () => {
    const estimate = createNatoriEstimate("立ち絵を商用利用でお願いします。表情差分もほしいです。");

    expect(estimate.replyDraft).toContain("概算");
    expect(estimate.replyDraft).toContain("正式料金は詳細確認後に確定します");
    expect(estimate.replyDraft).toContain("正式なお見積もりのため、下記を確認させてください");
  });

  it("uses edited pricing config values", () => {
    const config = createDefaultNatoriPricingConfig();
    config.baseItems = config.baseItems.map((item) =>
      item.id === "icon" ? { ...item, basePrice: 10000 } : item
    );
    config.percentageOptions = config.percentageOptions.map((option) =>
      option.id === "commercial_use" ? { ...option, rate: 0.25 } : option
    );

    const estimate = createNatoriEstimate("アイコンを商用利用で使いたいです。", config);

    expect(estimate.breakdown.base.amount).toBe(10000);
    expect(estimate.breakdown.percentage[0].amount).toBe(2500);
    expect(estimate.total).toBe(12500);
  });
});

describe("formatYen", () => {
  it("formats JPY without decimals", () => {
    expect(formatYen(28800)).toBe("￥28,800");
  });
});

