import { describe, expect, it } from "vitest";
import publicSnapshot from "./fixtures/portfolioWorkflow.public-20261001.json";

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
      "内容のご相談・お見積もり",
      "ご依頼確定・お支払い",
      "カラーラフのご確認",
      "清書・納品",
    ]);
    expect(resolved[1].body).toContain("2〜3日以内にお返事");
    expect(resolved[1].body).toContain("内容が決まったら、金額・納期");
    expect(resolved[0].body).toContain("フォームの送信だけでご依頼は確定しません");
    expect(resolved[1].body).not.toContain("以内にお見積もり");
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


describe("observed public workflow compatibility", () => {
  const observed = () => publicSnapshot.workflow.map((step) => ({ ...step }));
  it("projects only the three approved fields of the exact observed revision without changing input", () => {
    const source = observed(), before = JSON.stringify(source);
    source.forEach(Object.freeze); Object.freeze(source);
    const resolved = resolvePortfolioWorkflow(source);
    expect(resolved).not.toBe(source);
    expect(resolved[0]).toEqual({ ...source[0], body: NATORI_PUBLIC_WORKFLOW[0].body });
    expect(resolved[1]).toEqual({ ...source[1], title: NATORI_PUBLIC_WORKFLOW[1].title, body: NATORI_PUBLIC_WORKFLOW[1].body });
    for (let index = 2; index < source.length; index++) expect(resolved[index]).toBe(source[index]);
    expect(JSON.stringify(source)).toBe(before);
    expect(resolved[1].body).toContain("2〜3日以内にお返事");
    expect(resolved[1].body).toContain("金額・納期とご依頼確定のページ");
    expect(resolved[0].body).toContain("フォームの送信だけでご依頼は確定しません");
  });
  it.each([0, 1, 2, 3, 4])("preserves a body customization in observed step %s", (index) => {
    const source = observed(); source[index].body += "\n独自の大切な条件です。";
    expect(resolvePortfolioWorkflow(source)).toBe(source);
  });
  it.each(["title", "reorder", "removed-step", "extra-field"])("preserves customized observed shape/text: %s", (kind) => {
    const source = observed();
    if (kind === "title") source[0].title = "独自の相談手順";
    if (kind === "reorder") [source[2], source[3]] = [source[3], source[2]];
    if (kind === "removed-step") source.pop();
    if (kind === "extra-field") Object.assign(source[0], { importantNotice: "独自条件" });
    expect(resolvePortfolioWorkflow(source)).toBe(source);
  });
  it("leaves an already-corrected admin workflow unchanged", () => {
    const resolved = resolvePortfolioWorkflow(observed());
    expect(resolvePortfolioWorkflow(resolved)).toBe(resolved);
  });
});
