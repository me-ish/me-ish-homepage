import { describe, expect, it } from "vitest";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import { NATORI_INTAKE_BUDGET_CHIPS } from "@/features/natori/constants/intakeBudgetChips";
import {
  applyPortfolioPlanPick,
  parsePortfolioPlanPrice,
  portfolioBaseEstimate,
  portfolioPlanChoiceLabel,
  portfolioPlanPickValue,
} from "../portfolioPlanPicker";
import { applyPortfolioBudgetChip, portfolioBudgetChipId } from "../portfolioBudgetChips";
import {
  applyPortfolioPlanSelection,
  applyPortfolioRequestTypeSelection,
  buildNatoriRequestDataV1,
  createInitialPortfolioRequestFormState,
  NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE,
} from "../portfolioRequestForm";

const initial = () => ({ ...createInitialPortfolioRequestFormState(), inquiryMode: "quote" as const, message: "テスト" });

describe("描く範囲カード", () => {
  it("初期状態は何も選ばれていない（「まだ決めていない」は置かない）", () => {
    expect(portfolioPlanPickValue(initial())).toBeNull();
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

  it("以前の下書きに残る立ち絵・アイコンは、範囲のカードとして扱う", () => {
    const standingBust = { ...initial(), requestType: "standing" as const, commissionScope: "bust_up" as const };
    expect(portfolioPlanPickValue(standingBust)).toBe("bust_up");
    expect(portfolioBaseEstimate(standingBust, defaultPortfolioContent.plans)?.amount).toBe(
      parsePortfolioPlanPrice(defaultPortfolioContent.plans.find((plan) => plan.id === "bust_up")!.price),
    );
    const illustrationOnly = { ...initial(), requestType: "illustration" as const };
    expect(portfolioPlanPickValue(illustrationOnly)).toBeNull();
  });

  it("量産イラストはチップで選べて、料金の目安は出さない", () => {
    const mass = applyPortfolioPlanPick(initial(), "mass_production");
    expect(mass).toEqual(applyPortfolioRequestTypeSelection(initial(), NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE));
    expect(portfolioPlanPickValue(mass)).toBe("mass_production");
    expect(portfolioBaseEstimate(mass, defaultPortfolioContent.plans)).toBeNull();
  });

  it("SD・それ以外を選ぶと、前に選んだ範囲は残さない", () => {
    const full = applyPortfolioPlanPick(initial(), "full_body");
    expect(applyPortfolioPlanPick(full, "sd").commissionScope).toBe("undecided");
    expect(applyPortfolioPlanPick(full, "other").commissionScope).toBe("undecided");
  });

  it("料金表から来ても、カードで選んでも、同じ内容になる", () => {
    for (const plan of ["sd", "bust_up", "waist_up", "full_body"] as const) {
      const viaLink = applyPortfolioPlanSelection(initial(), plan);
      const viaCard = applyPortfolioPlanPick({ ...initial(), inquiryMode: "quote" }, plan);
      expect(buildNatoriRequestDataV1(viaLink, [])).toEqual(buildNatoriRequestDataV1(viaCard, []));
    }
  });

  it("選んでいる内容をカードと同じ言葉で表す", () => {
    const plans = defaultPortfolioContent.plans;
    expect(portfolioPlanChoiceLabel(applyPortfolioPlanPick(initial(), "full_body"), plans)).toBe(
      plans.find((plan) => plan.id === "full_body")!.name,
    );
    expect(portfolioPlanChoiceLabel(initial(), plans)).toBeNull();
    expect(portfolioPlanChoiceLabel({ ...applyPortfolioPlanPick(initial(), "other"), requestTypeOther: "ロゴ" }, plans)).toBe("それ以外（ロゴ）");
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

  it("量産・それ以外・未選択では出さない", () => {
    for (const pick of ["mass_production", "other"] as const) {
      expect(portfolioBaseEstimate(applyPortfolioPlanPick(initial(), pick), defaultPortfolioContent.plans)).toBeNull();
    }
    expect(portfolioBaseEstimate(initial(), defaultPortfolioContent.plans)).toBeNull();
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
