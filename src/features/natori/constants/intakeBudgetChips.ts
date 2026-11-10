// features/natori/constants/intakeBudgetChips.ts
// 依頼フォームの「ご予算」「希望納期」チップ。金額の刻みと文言はここだけで決める。
import { NATORI_RUSH_DELIVERY_AMOUNT } from "@/features/natori/constants/portfolioPricing";
import type { NatoriBudgetV1, NatoriDeadlineV1 } from "@/features/natori/types/request";

export type IntakeBudgetChip = {
  id: string;
  label: string;
  kind: NatoriBudgetV1["kind"];
  /** フォーム state にそのまま入れる文字列（fixed は入力欄で決める） */
  min: string;
  max: string;
};

export const NATORI_INTAKE_BUDGET_CHIPS: readonly IntakeBudgetChip[] = [
  { id: "undecided", label: "未定・相談して決めたい", kind: "undecided", min: "", max: "" },
  { id: "under_5000", label: "〜5,000円", kind: "range", min: "0", max: "5000" },
  { id: "5000_10000", label: "5,000〜10,000円", kind: "range", min: "5000", max: "10000" },
  { id: "10000_20000", label: "10,000〜20,000円", kind: "range", min: "10000", max: "20000" },
  { id: "over_20000", label: "20,000円〜", kind: "range", min: "20000", max: "" },
  { id: "fixed", label: "金額を入力", kind: "fixed", min: "", max: "" },
] as const;

/**
 * 「希望納期」チップの文言。確認画面・管理画面の表記（requestPresentation）は変えず、
 * フォームのチップだけ短くする。「希望日」は日付欄のラベルと重ならない言い方にする。
 */
export const NATORI_INTAKE_DEADLINE_CHIP_LABELS: Readonly<Record<NatoriDeadlineV1["kind"], string>> = {
  undecided: "未定・相談して決めたい",
  standard: "通常でOK（入金後 約1か月）",
  preferred_date: "希望の日付がある",
  rush_consultation: `お急ぎ（+${NATORI_RUSH_DELIVERY_AMOUNT.toLocaleString("ja-JP")}円／要相談）`,
};
