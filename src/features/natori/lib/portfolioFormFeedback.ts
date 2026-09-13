// 公開フォームの表示・エラー誘導専用。受付条件は requestSchema.ts に置く。
import type { ZodIssue } from "zod";
import {
  buildSelectedOptions,
  isMassProductionIllustrationSelection,
  type PortfolioOptionChoice,
  type PortfolioRequestFormState,
} from "./portfolioRequestForm";

type Section = "requestType" | "usage" | "budget" | "materials" | "details";
type FieldTarget = { id: string; section?: Section };

const fieldTargets: Record<string, FieldTarget> = {
  clientName: { id: "pf-name" },
  clientEmail: { id: "pf-email" },
  "requestData.message": { id: "pf-message" },
  "requestData.requestType": { id: "pf-request-type", section: "requestType" },
  "requestData.requestTypeOther": { id: "pf-request-type-other", section: "requestType" },
  "requestData.commissionScope": { id: "pf-scope", section: "requestType" },
  "requestData.commissionScopeOther": { id: "pf-scope-other", section: "requestType" },
  "requestData.usageTypes": { id: "pf-usage-types", section: "usage" },
  "requestData.usageTypeOther": { id: "pf-usage-other", section: "usage" },
  "requestData.commercialUse": { id: "pf-commercial", section: "usage" },
  "requestData.publicationPolicy": { id: "pf-publication", section: "usage" },
  "requestData.publicationAllowedFrom": { id: "pf-publication-allowed-from", section: "usage" },
  "requestData.budget.kind": { id: "pf-budget-kind", section: "budget" },
  "requestData.budget.min": { id: "pf-budget-min", section: "budget" },
  "requestData.budget.max": { id: "pf-budget-max", section: "budget" },
  "requestData.deadline.kind": { id: "pf-deadline-kind", section: "budget" },
  "requestData.deadline.date": { id: "pf-deadline-date", section: "budget" },
  "requestData.deadline.note": { id: "pf-deadline-note", section: "budget" },
  "requestData.characterFeatures": { id: "pf-character", section: "details" },
  "requestData.expressionMood": { id: "pf-expression", section: "details" },
  "requestData.composition": { id: "pf-composition", section: "details" },
  "requestData.colorDirection": { id: "pf-color", section: "details" },
  "requestData.referenceNotes": { id: "pf-reference-notes", section: "details" },
  refImages: { id: "pf-add-images", section: "materials" },
};

export function portfolioErrorTarget(
  path: string,
  state: PortfolioRequestFormState,
  choices: PortfolioOptionChoice[],
): FieldTarget {
  if (state.budgetKind === "fixed" && /^requestData\.budget\.(min|max)$/.test(path)) {
    return { id: "pf-budget-fixed", section: "budget" };
  }
  if (isMassProductionIllustrationSelection(state)) {
    if (path === "requestData.expressionMood") return { id: "pf-mass-expression", section: "requestType" };
    if (path === "requestData.commercialUse") return { id: "pf-mass-commercial", section: "requestType" };
  }
  const option = /^requestData\.options\.(\d+)(?:\.(\w+))?$/.exec(path);
  if (option) {
    const selected = buildSelectedOptions(state, choices)[Number(option[1])];
    const choice = choices.find((item) => item.stableId === selected?.id);
    if (choice) {
      const suffix = option[2] === "quantity" || option[2] === "notes" ? `-${option[2]}` : "";
      return { id: `pf-option-${choice.key}${suffix}`, section: "requestType" };
    }
  }
  const reference = /^referenceLinks\.(\d+)(?:\.(url|label))?$/.exec(path);
  if (reference) {
    return { id: `pf-ref-${reference[2] === "label" ? "label" : "url"}-${reference[1]}`, section: "materials" };
  }
  return fieldTargets[path] ?? { id: "pf-submit-errors" };
}

/** スキーマの判定を変えず、標準の英語エラーだけ入力者向けに翻訳する。 */
export function portfolioValidationMessage(issue: ZodIssue): string {
  if (/[ぁ-んァ-ヶ一-龠]/u.test(issue.message)) return issue.message;
  const path = issue.path.join(".");
  if (path === "clientName") return "お名前を1〜100文字で入力してください。";
  if (path === "clientEmail") return "メールアドレスの形式と文字数（254文字まで）をご確認ください。";
  if (/^requestData\.budget\.(min|max)$/.test(path)) {
    return "ご予算は半角数字で入力してください（例：10000）。";
  }
  if (path.endsWith(".quantity")) return "数量は1〜10の整数で入力してください。";
  if (issue.code === "too_big") return `${String(issue.maximum)}文字以内で入力してください。`;
  return "入力内容をご確認ください。";
}

/** Retry-After の秒数・HTTP日付の両形式に対応。ヘッダー欠落時は待ち時間を推定しない。 */
export function portfolioRetryAfterSeconds(value: string | null, now = Date.now()): number | null {
  if (!value?.trim()) return null;
  const input = value.trim();
  const seconds = /^\d+$/.test(input) ? Number(input) : (Date.parse(input) - now) / 1000;
  return Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : null;
}
