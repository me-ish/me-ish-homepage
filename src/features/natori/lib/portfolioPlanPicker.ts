// features/natori/lib/portfolioPlanPicker.ts
// 依頼フォームの「描く範囲」カードと、フォーム state（ご依頼の種類・制作範囲）の対応。
// カードは state から作る派生表示で、選んだときは state だけを書き換える。
// 依頼者には「ご依頼の種類」を選ばせない（2026-11-12）。値段は範囲で決まり、使いみちは別に聞いているため。
// 保存する種類は、範囲のカードなら illustration、SD は sd、量産・それ以外は other のまま。
import {
  NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE,
  applyPortfolioRequestTypeSelection,
  isMassProductionIllustrationSelection,
  pruneHiddenPortfolioRequestFields,
  type PortfolioRequestFormState,
} from "@/features/natori/lib/portfolioRequestForm";
import type { PortfolioPlan } from "@/features/natori/types/portfolio";

export const PORTFOLIO_PLAN_PICK_CARDS = ["sd", "bust_up", "waist_up", "full_body"] as const;
export const PORTFOLIO_PLAN_PICK_CHIPS = ["mass_production", "other", "undecided"] as const;

export type PortfolioPlanPickCard = (typeof PORTFOLIO_PLAN_PICK_CARDS)[number];
export type PortfolioPlanPick = PortfolioPlanPickCard | (typeof PORTFOLIO_PLAN_PICK_CHIPS)[number];

export const PORTFOLIO_PLAN_PICK_CHIP_LABELS: Readonly<Record<(typeof PORTFOLIO_PLAN_PICK_CHIPS)[number], string>> = {
  mass_production: "量産イラスト",
  other: "それ以外",
  undecided: "まだ決めていない",
};

const SCOPE_CARDS = new Set<string>(["bust_up", "waist_up", "full_body"]);

/**
 * 今の state がどのカード／チップに当たるか。どれにも当たらない組み合わせは null。
 * 以前の下書きに残る「立ち絵」「SNSアイコン」は、範囲が決まっていればその範囲のカードとして扱う。
 */
export function portfolioPlanPickValue(state: PortfolioRequestFormState): PortfolioPlanPick | null {
  if (isMassProductionIllustrationSelection(state)) return "mass_production";
  if (state.requestType === "sd") return "sd";
  if (state.requestType === "other") return "other";
  if (SCOPE_CARDS.has(state.commissionScope)) return state.commissionScope as PortfolioPlanPick;
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
  if (pick === "mass_production") {
    return applyPortfolioRequestTypeSelection(state, NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE);
  }
  // SD・それ以外は範囲を聞かない。前に選んだ範囲が残ると、確認画面と先生の画面に余計な行が出る。
  const typed = applyPortfolioRequestTypeSelection(state, pick);
  return pruneHiddenPortfolioRequestFields({ ...typed, commissionScope: "undecided", commissionScopeOther: "" });
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

const CARD_FALLBACK_NAMES: Readonly<Record<PortfolioPlanPickCard, string>> = {
  sd: "SDキャラ",
  bust_up: "胸上",
  waist_up: "膝〜腰上",
  full_body: "全身",
};

/** いま選んでいる内容を、カードやチップと同じ言葉で表す（見出しの要約・料金表から来たときの案内に使う）。 */
export function portfolioPlanChoiceLabel(
  state: PortfolioRequestFormState,
  plans: readonly PortfolioPlan[],
): string | null {
  const pick = portfolioPlanPickValue(state);
  if (pick === null) return null;
  if (pick === "mass_production") {
    const design = state.commissionScopeOther.trim();
    return design ? `${PORTFOLIO_PLAN_PICK_CHIP_LABELS.mass_production}（${design}）` : PORTFOLIO_PLAN_PICK_CHIP_LABELS.mass_production;
  }
  if (pick === "other") {
    const detail = state.requestTypeOther.trim();
    return detail ? `${PORTFOLIO_PLAN_PICK_CHIP_LABELS.other}（${detail}）` : PORTFOLIO_PLAN_PICK_CHIP_LABELS.other;
  }
  if (pick === "undecided") return PORTFOLIO_PLAN_PICK_CHIP_LABELS.undecided;
  return plans.find((plan) => plan.id === pick)?.name.trim() || CARD_FALLBACK_NAMES[pick];
}
