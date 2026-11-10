// features/natori/lib/portfolioDraft.ts
// 依頼フォームの下書き（この端末だけに置く）の直列化と読み戻し。localStorage には触らない純関数。
// お名前・メールアドレス・参考画像は持たない（個人情報とファイルは端末に残さない）。
import {
  createInitialPortfolioRequestFormState,
  type PortfolioOptionSelection,
  type PortfolioReferenceLinkRow,
  type PortfolioRequestFormState,
} from "@/features/natori/lib/portfolioRequestForm";
import {
  NATORI_COMMISSION_SCOPES_V1,
  NATORI_REQUEST_TYPE_VALUES_V1,
  NATORI_USAGE_TYPES_V1,
} from "@/features/natori/types/request";

export const PORTFOLIO_DRAFT_STORAGE_KEY = "natori.portfolio.intake.draft.v1";
export const PORTFOLIO_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type PortfolioDraft = {
  state: PortfolioRequestFormState;
  step: number;
  savedAt: number;
  /** 保存した時点で参考画像を選んでいたか（画像そのものは保存しない）。 */
  hadImages: boolean;
};

type StoredDraft = { version: 1 } & PortfolioDraft;

const INQUIRY_MODES = ["consultation", "quote"] as const;
const COMMERCIAL_USES = ["none", "yes", "unknown"] as const;
const PUBLICATION_POLICIES = ["allowed", "delayed", "work_private", "fully_private", "unknown"] as const;
const BUDGET_KINDS = ["undecided", "range", "fixed"] as const;
const DEADLINE_KINDS = ["undecided", "standard", "preferred_date", "rush_consultation"] as const;
const TEXT_KEYS = [
  "requestTypeOther", "commissionScopeOther", "usageTypeOther", "publicationAllowedFrom",
  "budgetMin", "budgetMax", "deadlineDate", "deadlineNote", "characterFeatures", "expressionMood",
  "composition", "colorDirection", "referenceNotes", "message",
] as const satisfies readonly (keyof PortfolioRequestFormState)[];
/** 1項目あたりの上限。フォームの最大文字数より十分大きく、壊れた値で画面が重くならない程度。 */
const MAX_TEXT = 10_000;

/** 入力が初期状態のままか（何も書いていなければ下書きを残さない）。 */
export function isBlankPortfolioDraftState(state: PortfolioRequestFormState): boolean {
  const initial = createInitialPortfolioRequestFormState();
  const comparable = (value: PortfolioRequestFormState) => ({
    ...value,
    inquiryMode: initial.inquiryMode,
    referenceLinks: value.referenceLinks.filter((row) => row.url.trim() || row.label.trim()),
    optionSelections: Object.fromEntries(Object.entries(value.optionSelections).filter(([, selection]) => selection.selected)),
  });
  return JSON.stringify(comparable(state)) === JSON.stringify(comparable(initial));
}

export function serializePortfolioDraft(draft: PortfolioDraft): string {
  const stored: StoredDraft = { version: 1, ...draft };
  return JSON.stringify(stored);
}

function oneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOptionSelections(value: unknown): Record<string, PortfolioOptionSelection> | null {
  if (!isRecord(value)) return null;
  const result: Record<string, PortfolioOptionSelection> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!isRecord(raw) || typeof raw.selected !== "boolean" || typeof raw.notes !== "string") return null;
    if (typeof raw.quantity !== "number" && typeof raw.quantity !== "string") return null;
    result[key] = { selected: raw.selected, quantity: raw.quantity, notes: raw.notes.slice(0, MAX_TEXT) };
  }
  return result;
}

function readReferenceLinks(value: unknown): PortfolioReferenceLinkRow[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) return null;
  const rows: PortfolioReferenceLinkRow[] = [];
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.url !== "string" || typeof raw.label !== "string") return null;
    rows.push({ url: raw.url.slice(0, MAX_TEXT), label: raw.label.slice(0, MAX_TEXT) });
  }
  return rows;
}

function readState(value: unknown): PortfolioRequestFormState | null {
  if (!isRecord(value)) return null;
  if (!oneOf(INQUIRY_MODES, value.inquiryMode)) return null;
  if (!oneOf(NATORI_REQUEST_TYPE_VALUES_V1, value.requestType)) return null;
  if (!oneOf(NATORI_COMMISSION_SCOPES_V1, value.commissionScope)) return null;
  if (!oneOf(COMMERCIAL_USES, value.commercialUse)) return null;
  if (!oneOf(PUBLICATION_POLICIES, value.publicationPolicy)) return null;
  if (!oneOf(BUDGET_KINDS, value.budgetKind)) return null;
  if (!oneOf(DEADLINE_KINDS, value.deadlineKind)) return null;
  if (!Array.isArray(value.usageTypes) || !value.usageTypes.every((item) => oneOf(NATORI_USAGE_TYPES_V1, item))) return null;
  const optionSelections = readOptionSelections(value.optionSelections);
  const referenceLinks = readReferenceLinks(value.referenceLinks);
  if (!optionSelections || !referenceLinks) return null;
  const text = {} as Record<(typeof TEXT_KEYS)[number], string>;
  for (const key of TEXT_KEYS) {
    const raw = value[key];
    if (typeof raw !== "string") return null;
    text[key] = raw.slice(0, MAX_TEXT);
  }
  return {
    ...createInitialPortfolioRequestFormState(),
    ...text,
    inquiryMode: value.inquiryMode,
    requestType: value.requestType,
    commissionScope: value.commissionScope,
    commercialUse: value.commercialUse,
    publicationPolicy: value.publicationPolicy,
    budgetKind: value.budgetKind,
    deadlineKind: value.deadlineKind,
    usageTypes: [...new Set(value.usageTypes)],
    optionSelections,
    referenceLinks,
  };
}

/** 保存した文字列を下書きに戻す。形が合わない・古すぎる（7日超）・未来の日時なら null。 */
export function parsePortfolioDraft(raw: string | null, now: number): PortfolioDraft | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.version !== 1) return null;
  const { savedAt, step, hadImages } = value;
  if (typeof savedAt !== "number" || !Number.isFinite(savedAt)) return null;
  if (savedAt > now || now - savedAt > PORTFOLIO_DRAFT_MAX_AGE_MS) return null;
  if (typeof step !== "number" || !Number.isInteger(step) || step < 0 || step > 2) return null;
  const state = readState(value.state);
  if (!state) return null;
  return { state, step, savedAt, hadImages: hadImages === true };
}
