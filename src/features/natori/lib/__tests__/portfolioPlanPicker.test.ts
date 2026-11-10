import { describe, expect, it } from "vitest";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import { NATORI_INTAKE_BUDGET_CHIPS } from "@/features/natori/constants/intakeBudgetChips";
import {
  applyPortfolioPlanPick,
  parsePortfolioPlanPrice,
  portfolioBaseEstimate,
  portfolioPlanPickValue,
} from "../portfolioPlanPicker";
import { applyPortfolioBudgetChip, portfolioBudgetChipId } from "../portfolioBudgetChips";
import {
  applyPortfolioRequestTypeSelection,
  buildNatoriRequestDataV1,
  createInitialPortfolioRequestFormState,
  NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE,
} from "../portfolioRequestForm";

const initial = () => ({ ...createInitialPortfolioRequestFormState(), inquiryMode: "quote" as const, message: "テスト" });

describe("描く範囲カード", () => {
  it("初期状態は「まだ決めていない」", () => {
    expect(portfolioPlanPickValue(initial())).toBe("undecided");
  });

  it("胸上・膝〜腰上・全身はイラスト＋制作範囲になる", () => {
    for (const pick of ["bust_up", "waist_up", "full_body"] as const) {
      const next = applyPortfolioPlanPick(initial(), pick);
      expect(next.requestType).toBe("illustration");
      expect(next.commissionScope).toBe(pick);
      expect(portfolioPlanPickValue(next)).toBe(pick);
    }
  });

  it("SD から胸上に切り替えると種類もイラストに戻る", () => {
    const sd = applyPortfolioPlanPick(initial(), "sd");
    expect(portfolioPlanPickValue(sd)).toBe("sd");
    const bust = applyPortfolioPlanPick(sd, "bust_up");
    expect(bust.requestType).toBe("illustration");
    expect(portfolioPlanPickValue(bust)).toBe("bust_up");
  });

  it("相談か見積もりかは変えない", () => {
    const consult = { ...initial(), inquiryMode: "consultation" as const };
    expect(applyPortfolioPlanPick(consult, "sd").inquiryMode).toBe("consultation");
  });

  it("「細かく選ぶ」でしか作れない組み合わせはどのカードにも当たらない", () => {
    const standingBust = { ...applyPortfolioPlanPick(initial(), "standing"), commissionScope: "bust_up" as const };
    expect(portfolioPlanPickValue(standingBust)).toBe("standing");
    const illustrationOnly = { ...initial(), requestType: "illustration" as const };
    expect(portfolioPlanPickValue(illustrationOnly)).toBeNull();
  });

  it("量産イラストはカードに出さない", () => {
    const mass = applyPortfolioRequestTypeSelection(initial(), NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE);
    expect(portfolioPlanPickValue(mass)).toBeNull();
    expect(portfolioBaseEstimate(mass, defaultPortfolioContent.plans)).toBeNull();
  });

  it("カードで選んでも送るデータは旧 UI の選択と同じ", () => {
    const viaCard = applyPortfolioPlanPick(initial(), "full_body");
    const viaSelects = { ...applyPortfolioRequestTypeSelection(initial(), "illustration"), commissionScope: "full_body" as const };
    expect(buildNatoriRequestDataV1(viaCard, [])).toEqual(buildNatoriRequestDataV1(viaSelects, []));
  });
});

describe("料金の目安（基本料金だけ）", () => {
  it("料金表の基本料金をそのまま返す", () => {
    const estimate = portfolioBaseEstimate(applyPortfolioPlanPick(initial(), "bust_up"), defaultPortfolioContent.plans);
    const plan = defaultPortfolioContent.plans.find((candidate) => candidate.id === "bust_up")!;
    expect(estimate).toEqual({ planName: plan.name, amount: parsePortfolioPlanPrice(plan.price) });
  });

  it("立ち絵・その他・未定では出さない", () => {
    for (const pick of ["standing", "other", "undecided"] as const) {
      expect(portfolioBaseEstimate(applyPortfolioPlanPick(initial(), pick), defaultPortfolioContent.plans)).toBeNull();
    }
  });

  it("金額として読めない料金は出さない", () => {
    expect(parsePortfolioPlanPrice("要相談")).toBeNull();
    expect(parsePortfolioPlanPrice("4,000円")).toBe(4000);
    expect(parsePortfolioPlanPrice("4,000円〜")).toBe(4000);
  });
});

describe("ご予算チップ", () => {
  const chip = (id: string) => NATORI_INTAKE_BUDGET_CHIPS.find((item) => item.id === id)!;

  it("範囲チップは下限・上限をそのまま入れる", () => {
    const next = applyPortfolioBudgetChip(initial(), chip("10000_20000"));
    expect(next).toMatchObject({ budgetKind: "range", budgetMin: "10000", budgetMax: "20000" });
    expect(portfolioBudgetChipId(next, NATORI_INTAKE_BUDGET_CHIPS)).toBe("10000_20000");
  });

  it("「20,000円〜」は上限なしで送る", () => {
    const next = applyPortfolioBudgetChip(initial(), chip("over_20000"));
    expect(buildNatoriRequestDataV1(next, []).budget).toEqual({ kind: "range", min: 20000, max: null, currency: "JPY" });
  });

  it("チップと合わない範囲は null（下限・上限の入力欄で見せる）", () => {
    expect(portfolioBudgetChipId({ budgetKind: "range", budgetMin: "10000", budgetMax: "15000" }, NATORI_INTAKE_BUDGET_CHIPS)).toBeNull();
  });

  it("「金額を入力」は金額欄を空から始める", () => {
    const fromRange = applyPortfolioBudgetChip(applyPortfolioBudgetChip(initial(), chip("5000_10000")), chip("fixed"));
    expect(fromRange).toMatchObject({ budgetKind: "fixed", budgetMin: "", budgetMax: "" });
  });
});
