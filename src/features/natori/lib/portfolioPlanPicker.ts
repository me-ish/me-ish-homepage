// features/natori/lib/portfolioPlanPicker.ts
// 依頼フォームの「描く範囲」カードと、フォーム state（ご依頼の種類・制作範囲）の対応。
// カードは state から作る派生表示で、選んだときは state だけを書き換える。
import {
  applyPortfolioRequestTypeSelection,
  isMassProductionIllustrationSelection,
  pruneHiddenPortfolioRequestFields,
  type PortfolioRequestFormState,
} from "@/features/natori/lib/portfolioRequestForm";
import type { PortfolioPlan } from "@/features/natori/types/portfolio";

export const PORTFOLIO_PLAN_PICK_CARDS = ["sd", "bust_up", "waist_up", "full_body"] as const;
export const PORTFOLIO_PLAN_PICK_CHIPS = ["standing", "other", "undecided"] as const;

export type PortfolioPlanPickCard = (typeof PORTFOLIO_PLAN_PICK_CARDS)[number];
export type PortfolioPlanPick = PortfolioPlanPickCard | (typeof PORTFOLIO_PLAN_PICK_CHIPS)[number];

export const PORTFOLIO_PLAN_PICK_CHIP_LABELS: Readonly<Record<(typeof PORTFOLIO_PLAN_PICK_CHIPS)[number], string>> = {
  standing: "立ち絵",
  other: "それ以外",
  undecided: "まだ決めていない",
};

const SCOPE_CARDS = new Set<string>(["bust_up", "waist_up", "full_body"]);

/** 今の state がどのカード／チップに当たるか。どれにも当たらない組み合わせ（立ち絵の胸上など）は null。 */
export function portfolioPlanPickValue(state: PortfolioRequestFormState): PortfolioPlanPick | null {
  if (isMassProductionIllustrationSelection(state)) return null;
  if (state.requestType === "sd") return "sd";
  if (state.requestType === "standing") return "standing";
  if (state.requestType === "other") return "other";
  if (
    (state.requestType === "illustration" || state.requestType === "undecided") &&
    SCOPE_CARDS.has(state.commissionScope)
  ) {
    return state.commissionScope as PortfolioPlanPick;
  }
  if (state.requestType === "undecided" && state.commissionScope === "undecided") return "undecided";
  return null;
}

/** カード／チップを選んだときの state。相談か見積もりかは変えない。 */
export function applyPortfolioPlanPick(
  state: PortfolioRequestFormState,
  pick: PortfolioPlanPick,
): PortfolioRequestFormState {
  if (pick === "bust_up" || pick === "waist_up" || pick === "full_body") {
    const typed = applyPortfolioRequestTypeSelection(state, "illustration");
    return pruneHiddenPortfolioRequestFields({ ...typed, commissionScope: pick, commissionScopeOther: "" });
  }
  if (pick === "undecided") {
    const typed = applyPortfolioRequestTypeSelection(state, "undecided");
    return pruneHiddenPortfolioRequestFields({ ...typed, commissionScope: "undecided", commissionScopeOther: "" });
  }
  return applyPortfolioRequestTypeSelection(state, pick);
}

/** 料金表の「3,000円」のような値を数値にする。読めなければ null。 */
export function parsePortfolioPlanPrice(price: string): number | null {
  const match = price.trim().match(/^([0-9][0-9,]*)円〜?$/u);
  if (!match) return null;
  const amount = Number(match[1].replaceAll(",", ""));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export type PortfolioBaseEstimate = { planName: string; amount: number };

/**
 * 「料金の目安」に出す基本料金。カードに当たる選択（SD／胸上／膝〜腰上／全身）のときだけ返す。
 * オプション・商用利用・お急ぎは足さない（正式な見積もりで確定する）。
 */
export function portfolioBaseEstimate(
  state: PortfolioRequestFormState,
  plans: readonly PortfolioPlan[],
): PortfolioBaseEstimate | null {
  const pick = portfolioPlanPickValue(state);
  if (!pick || !(PORTFOLIO_PLAN_PICK_CARDS as readonly string[]).includes(pick)) return null;
  const plan = plans.find((candidate) => candidate.id === pick);
  if (!plan) return null;
  const amount = parsePortfolioPlanPrice(plan.price);
  return amount === null ? null : { planName: plan.name.trim() || pick, amount };
}
