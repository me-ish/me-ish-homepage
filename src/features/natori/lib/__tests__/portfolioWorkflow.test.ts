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

  it("keeps a custom workflow unchanged", () => {
    const custom = [{ title: "独自ステップ", body: "独自の案内" }];

    expect(resolvePortfolioWorkflow(custom)).toBe(custom);
  });
});
