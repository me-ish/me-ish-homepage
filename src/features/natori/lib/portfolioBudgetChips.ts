// features/natori/lib/portfolioBudgetChips.ts
// 「ご予算」チップとフォーム state（budgetKind / budgetMin / budgetMax）の対応。
import type { IntakeBudgetChip } from "@/features/natori/constants/intakeBudgetChips";
import {
  pruneHiddenPortfolioRequestFields,
  type PortfolioRequestFormState,
} from "@/features/natori/lib/portfolioRequestForm";

const normalize = (value: string) => value.trim().replaceAll(",", "");

/**
 * 今の予算がどのチップに当たるか。範囲がどのチップとも合わない（再送の復元など）ときは null を返し、
 * 画面では下限・上限の入力欄で値を見せる。
 */
export function portfolioBudgetChipId(
  state: Pick<PortfolioRequestFormState, "budgetKind" | "budgetMin" | "budgetMax">,
  chips: readonly IntakeBudgetChip[],
): string | null {
  if (state.budgetKind === "undecided") return chips.find((chip) => chip.kind === "undecided")?.id ?? null;
  if (state.budgetKind === "fixed") return chips.find((chip) => chip.kind === "fixed")?.id ?? null;
  const min = normalize(state.budgetMin);
  const max = normalize(state.budgetMax);
  return chips.find((chip) => chip.kind === "range" && chip.min === min && chip.max === max)?.id ?? null;
}

export function applyPortfolioBudgetChip(
  state: PortfolioRequestFormState,
  chip: IntakeBudgetChip,
): PortfolioRequestFormState {
  if (chip.kind === "fixed") {
    // 入力済みの金額は残す（範囲から切り替えたときは下限を引き継がない）。
    const keep = state.budgetKind === "fixed" ? state.budgetMin : "";
    return pruneHiddenPortfolioRequestFields({ ...state, budgetKind: "fixed", budgetMin: keep, budgetMax: "" });
  }
  return pruneHiddenPortfolioRequestFields({ ...state, budgetKind: chip.kind, budgetMin: chip.min, budgetMax: chip.max });
}
