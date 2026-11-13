import { describe, expect, it } from "vitest";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import { applyPortfolioPlanPick } from "../portfolioPlanPicker";
import { formatPortfolioEstimateRange, portfolioClientEstimate } from "../portfolioClientEstimate";
import {
  createInitialPortfolioRequestFormState,
  massProductionOptionChoices,
  portfolioOptionChoices,
  type PortfolioRequestFormState,
} from "../portfolioRequestForm";

const content = defaultPortfolioContent;
const choices = portfolioOptionChoices(content);
const quote = (): PortfolioRequestFormState => ({ ...createInitialPortfolioRequestFormState(), inquiryMode: "quote" });
const pick = (id: string, quantity = "1") => ({ [id]: { selected: true, quantity, notes: "" } });

describe("依頼フォームの目安", () => {
  it("範囲を選んでいなければ出さない（それ以外・未選択）", () => {
    expect(portfolioClientEstimate(quote(), choices, content)).toBeNull();
    expect(portfolioClientEstimate(applyPortfolioPlanPick(quote(), "other"), choices, content)).toBeNull();
  });

  it("範囲だけなら基本料金", () => {
    const estimate = portfolioClientEstimate(applyPortfolioPlanPick(quote(), "full_body"), choices, content)!;
    expect(estimate).toMatchObject({ min: 10000, max: 10000, unpriced: [] });
    expect(estimate.lines).toHaveLength(1);
    expect(estimate.lines[0]).toMatchObject({ id: "full_body", base: true, amount: 10000 });
  });

  it("オプション・数量・商用利用・お急ぎ・非公開を足す", () => {
    const state: PortfolioRequestFormState = {
      ...applyPortfolioPlanPick(quote(), "full_body"),
      optionSelections: { ...pick("expression_variation", "2"), ...pick("complex_prop") },
      commercialUse: "yes",
      publicationPolicy: "fully_private",
      deadlineKind: "rush_consultation",
    };
    const estimate = portfolioClientEstimate(state, choices, content)!;
    // 10,000 + 500×2 + 500 + 3,000 + 2,000 + 2,000
    expect(estimate.min).toBe(18500);
    expect(estimate.max).toBe(18500);
    expect(estimate.lines.find((line) => line.id === "expression_variation")).toMatchObject({ quantity: 2, amount: 1000 });
  });

  it("人物追加は基本料金の70%、しっかり背景は幅で出す", () => {
    const state: PortfolioRequestFormState = {
      ...applyPortfolioPlanPick(quote(), "bust_up"),
      optionSelections: { ...pick("additional_character"), ...pick("detailed_background") },
    };
    const estimate = portfolioClientEstimate(state, choices, content)!;
    // 4,000 + 2,800 + 3,000〜5,000
    expect(estimate.min).toBe(9800);
    expect(estimate.max).toBe(11800);
    expect(formatPortfolioEstimateRange(estimate.min, estimate.max)).toBe("9,800〜11,800円");
  });

  it("金額として読めない料金は足さず、別途として返す", () => {
    const custom = { ...content, options: content.options.map((option) => option.id === "complex_prop" ? { ...option, price: "要相談" } : option) };
    const state: PortfolioRequestFormState = {
      ...applyPortfolioPlanPick(quote(), "sd"),
      optionSelections: pick("complex_prop"),
    };
    const estimate = portfolioClientEstimate(state, portfolioOptionChoices(custom), custom)!;
    expect(estimate.min).toBe(3000);
    expect(estimate.unpriced).toEqual(["複雑な小物追加"]);
  });

  it("量産イラストはデザインを選んだら専用の料金で出す", () => {
    const mass = applyPortfolioPlanPick(quote(), "mass_production");
    expect(portfolioClientEstimate(mass, massProductionOptionChoices(), content)).toBeNull();
    const estimate = portfolioClientEstimate({ ...mass, commissionScopeOther: "おばけ" }, massProductionOptionChoices(), content)!;
    expect(estimate.lines[0]).toMatchObject({ id: "mass_production_illustration", base: true });
    expect(estimate.min).toBeGreaterThan(0);
  });

  it("専用の欄（商用利用・実績掲載）の料金が金額として読めないときも「別途」に出す", () => {
    const odd = { ...content, options: content.options.map((option) =>
      option.id === "commercial_use" || option.id === "private_work" ? { ...option, price: "要相談" } : option) };
    const estimate = portfolioClientEstimate(
      { ...applyPortfolioPlanPick(quote(), "full_body"), commercialUse: "yes", publicationPolicy: "fully_private" },
      portfolioOptionChoices(odd), odd)!;
    expect(estimate.min).toBe(10000);
    expect(estimate.unpriced).toHaveLength(2);
  });

  it("プランの料金は下限なので、幅が無い合計には「〜」を付ける", () => {
    expect(formatPortfolioEstimateRange(10000, 10000, true)).toBe("10,000円〜");
    expect(formatPortfolioEstimateRange(2000, 2000)).toBe("2,000円");
    expect(formatPortfolioEstimateRange(21000, 23000, true)).toBe("21,000〜23,000円");
  });
});
