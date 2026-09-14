import { describe, expect, it } from "vitest";

import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import {
  NATORI_PUBLIC_WORKFLOW,
  resolvePortfolioWorkflow,
} from "@/features/natori/lib/portfolioWorkflow";

describe("portfolioWorkflow", () => {
  it("replaces the legacy six-step default with the current order flow", () => {
    const resolved = resolvePortfolioWorkflow(defaultPortfolioContent.workflow);

    expect(resolved).toEqual(NATORI_PUBLIC_WORKFLOW);
    expect(resolved).toHaveLength(5);
    expect(resolved.map((step) => step.title)).toEqual([
      "ご依頼フォームから送信",
      "お見積もり・内容確認",
      "ご依頼確定・お支払い",
      "カラーラフのご確認",
      "清書・納品",
    ]);
    expect(resolved[1].body).toContain("承諾ページ");
    expect(resolved[2].body).toContain("カード決済用のお支払いリンク");
    expect(resolved[3].body).toContain("量産イラストは原則リテイクなし");
    expect(resolved[4].body).toContain("受け取りました");
  });

  it("also replaces the legacy workflow currently saved in production", () => {
    const savedLegacy = defaultPortfolioContent.workflow.map((step) => ({ ...step }));
    savedLegacy[2] = {
      ...savedLegacy[2],
      body: "お見積もりにご承諾いただけましたら、お支払い用のリンクをメールでお送りします。ご入金の確認後、制作を開始いたします。",
    };

    expect(resolvePortfolioWorkflow(savedLegacy)).toEqual(NATORI_PUBLIC_WORKFLOW);
  });

  it("keeps body-only editor customizations unchanged", () => {
    const customized = defaultPortfolioContent.workflow.map((step) => ({ ...step }));
    customized[3] = {
      ...customized[3],
      body: "ラフ確認は独自の進行方法でご案内します。",
    };

    expect(resolvePortfolioWorkflow(customized)).toBe(customized);
  });

  it("keeps a fully custom workflow unchanged", () => {
    const custom = [{ title: "独自ステップ", body: "独自の案内" }];

    expect(resolvePortfolioWorkflow(custom)).toBe(custom);
  });
});
