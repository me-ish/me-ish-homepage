import { describe, expect, it } from "vitest";
import {
  PORTFOLIO_DRAFT_MAX_AGE_MS,
  isBlankPortfolioDraftState,
  parsePortfolioDraft,
  serializePortfolioDraft,
} from "@/features/natori/lib/portfolioDraft";
import { createInitialPortfolioRequestFormState } from "@/features/natori/lib/portfolioRequestForm";

const NOW = Date.UTC(2026, 10, 10, 12);

function filledState() {
  return {
    ...createInitialPortfolioRequestFormState(),
    inquiryMode: "quote" as const,
    requestType: "illustration" as const,
    commissionScope: "waist_up" as const,
    usageTypes: ["social_icon" as const],
    budgetKind: "range" as const,
    budgetMin: "10000",
    budgetMax: "20000",
    message: "誰を：オリジナルの女の子",
    optionSelections: { expression: { selected: true, quantity: 2, notes: "笑顔" } },
    referenceLinks: [{ url: "https://example.com/a", label: "衣装" }],
  };
}

describe("portfolioDraft", () => {
  it("保存した内容をそのまま読み戻す", () => {
    const raw = serializePortfolioDraft({ state: filledState(), step: 1, savedAt: NOW - 1000, hadImages: true });
    expect(parsePortfolioDraft(raw, NOW)).toEqual({ state: filledState(), step: 1, savedAt: NOW - 1000, hadImages: true });
  });

  it("お名前・メールアドレスは保存しない", () => {
    const raw = serializePortfolioDraft({ state: filledState(), step: 0, savedAt: NOW, hadImages: false });
    expect(raw).not.toMatch(/clientName|clientEmail|@example\.org/);
  });

  it("7日を過ぎた下書き・未来の日時の下書きは読まない", () => {
    const old = serializePortfolioDraft({ state: filledState(), step: 0, savedAt: NOW - PORTFOLIO_DRAFT_MAX_AGE_MS - 1, hadImages: false });
    const future = serializePortfolioDraft({ state: filledState(), step: 0, savedAt: NOW + 60_000, hadImages: false });
    expect(parsePortfolioDraft(old, NOW)).toBeNull();
    expect(parsePortfolioDraft(future, NOW)).toBeNull();
  });

  it.each([
    ["空", null],
    ["JSON でない", "{"],
    ["版が違う", JSON.stringify({ version: 2 })],
    ["種類が不正", serializePortfolioDraft({ state: { ...filledState(), requestType: "hacked" as never }, step: 0, savedAt: NOW, hadImages: false })],
    ["使いみちが不正", serializePortfolioDraft({ state: { ...filledState(), usageTypes: ["x" as never] }, step: 0, savedAt: NOW, hadImages: false })],
    ["本文が文字列でない", serializePortfolioDraft({ state: { ...filledState(), message: 1 as never }, step: 0, savedAt: NOW, hadImages: false })],
    ["ステップが範囲外", serializePortfolioDraft({ state: filledState(), step: 5, savedAt: NOW, hadImages: false })],
    ["参考URLの行が空", serializePortfolioDraft({ state: { ...filledState(), referenceLinks: [] }, step: 0, savedAt: NOW, hadImages: false })],
  ])("%s なら null", (_label, raw) => {
    expect(parsePortfolioDraft(raw, NOW)).toBeNull();
  });

  it("何も書いていない状態は空とみなす（相談・見積もりの切り替えだけでは残さない）", () => {
    expect(isBlankPortfolioDraftState(createInitialPortfolioRequestFormState())).toBe(true);
    expect(isBlankPortfolioDraftState({ ...createInitialPortfolioRequestFormState(), inquiryMode: "quote" })).toBe(true);
    expect(isBlankPortfolioDraftState({ ...createInitialPortfolioRequestFormState(), message: "a" })).toBe(false);
    expect(isBlankPortfolioDraftState(filledState())).toBe(false);
  });
});
