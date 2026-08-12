// features/natori/lib/portfolioRequestForm.ts
// ご依頼フォームの入力 state を RequestData V1 の canonical object へ変換する純関数。
// UI はここだけを使い、独自の payload 形を作らない。server は同じ共有 schema で
// 再 parse するため、ここでの結果は UX 用の下書きであって真実源ではない。
// DB・fetch・process.env には依存しない。
import {
  NATORI_REFERENCE_LINK_MAX_LENGTH,
  normalizeNatoriReferenceUrl,
} from "@/features/natori/lib/referenceLinks";
import { PORTFOLIO_OPTION_IDS } from "@/features/natori/constants/portfolioContent";
import { NATORI_REQUEST_SCHEMA_VERSION } from "@/features/natori/types/request";
import type {
  NatoriBudgetV1,
  NatoriCommissionScopeV1,
  NatoriDeadlineV1,
  NatoriInquiryModeV1,
  NatoriRequestDataV1,
  NatoriRequestTypeV1,
  NatoriSelectedOptionV1,
  NatoriUsageTypeV1,
} from "@/features/natori/types/request";
import type { PortfolioContent } from "@/features/natori/types/portfolio";

/** multipart の入口で payload version を明示分岐するための固定値。 */
export const NATORI_STRUCTURED_FORM_VERSION = "etorie-request-v1";

export const NATORI_MAX_REFERENCE_IMAGES = 5;
export const NATORI_MAX_REFERENCE_LINKS = 5;
export const NATORI_REFERENCE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const NATORI_REFERENCE_IMAGES_TOTAL_MAX_BYTES = 10 * 1024 * 1024;

/** 依頼者が任意補足を書く「その他」オプションの stable ID。 */
export const NATORI_OTHER_OPTION_ID = "other";
const OTHER_OPTION_LABEL = "その他のオプション";
const OPTION_LABEL_MAX_LENGTH = 100;
const OPTION_NOTES_MAX_LENGTH = 300;
const QUANTITY_OPTION_IDS = new Set<string>([
  PORTFOLIO_OPTION_IDS.complexProp,
  PORTFOLIO_OPTION_IDS.mascotProp,
  PORTFOLIO_OPTION_IDS.expressionVariation,
  PORTFOLIO_OPTION_IDS.additionalCharacter,
]);
const DEDICATED_FIELD_OPTION_IDS = new Set<string>([
  PORTFOLIO_OPTION_IDS.commercialUse,
  PORTFOLIO_OPTION_IDS.sampleUsageDenied,
  PORTFOLIO_OPTION_IDS.privateWork,
]);

export type PortfolioOptionChoice = {
  /** React key / DOM id 用。stable ID が無い項目でも一意になる。 */
  key: string;
  /**
   * RequestData V1 へ送る stable ID。掲載設定に ID が無い legacy 項目は null で、
   * label から ID を推定せず「その他」オプションの補足へ集約する。
   */
  stableId: string | null;
  /** 依頼者が実際に見た表示名の snapshot。 */
  label: string;
  /** 画面表示専用の価格表記。request_data には保存しない。 */
  price: string;
};

export type PortfolioOptionSelection = {
  selected: boolean;
  quantity: number;
  notes: string;
};

export type PortfolioReferenceLinkRow = {
  url: string;
  label: string;
};

export type PortfolioRequestFormState = {
  inquiryMode: NatoriInquiryModeV1;
  requestType: NatoriRequestTypeV1;
  requestTypeOther: string;
  commissionScope: NatoriCommissionScopeV1;
  commissionScopeOther: string;
  /** key は PortfolioOptionChoice.key。 */
  optionSelections: Record<string, PortfolioOptionSelection>;
  usageTypes: NatoriUsageTypeV1[];
  usageTypeOther: string;
  commercialUse: NatoriRequestDataV1["commercialUse"];
  publicationPolicy: NatoriRequestDataV1["publicationPolicy"];
  publicationAllowedFrom: string;
  budgetKind: NatoriBudgetV1["kind"];
  budgetMin: string;
  budgetMax: string;
  deadlineKind: NatoriDeadlineV1["kind"];
  deadlineDate: string;
  deadlineNote: string;
  characterFeatures: string;
  expressionMood: string;
  composition: string;
  colorDirection: string;
  referenceNotes: string;
  message: string;
  referenceLinks: PortfolioReferenceLinkRow[];
};

export function createInitialPortfolioRequestFormState(): PortfolioRequestFormState {
  return {
    inquiryMode: "consultation",
    requestType: "undecided",
    requestTypeOther: "",
    commissionScope: "undecided",
    commissionScopeOther: "",
    optionSelections: {},
    usageTypes: [],
    usageTypeOther: "",
    commercialUse: "unknown",
    publicationPolicy: "unknown",
    publicationAllowedFrom: "",
    budgetKind: "undecided",
    budgetMin: "",
    budgetMax: "",
    deadlineKind: "undecided",
    deadlineDate: "",
    deadlineNote: "",
    characterFeatures: "",
    expressionMood: "",
    composition: "",
    colorDirection: "",
    referenceNotes: "",
    message: "",
    referenceLinks: [{ url: "", label: "" }],
  };
}

/**
 * 掲載設定の追加オプションを、フォームの選択肢へ変換する。
 * 商用利用・公開可否は専用フィールドで回答するため、重複する項目は除く。
 * 掲載 ID をそのまま stable ID として使い、label 一致からの推定はしない。
 */
export function portfolioOptionChoices(
  content: Pick<PortfolioContent, "options">
): PortfolioOptionChoice[] {
  return content.options
    .filter((option) => option.id === null || !DEDICATED_FIELD_OPTION_IDS.has(option.id))
    .map((option, index) => ({
      key: option.id ?? `legacy-option-${index}`,
      stableId: option.id,
      label: option.name.trim().slice(0, OPTION_LABEL_MAX_LENGTH),
      price: option.price,
    }));
}

/** 個数で料金が増えるオプションだけ数量入力を表示する。legacy項目は安全側で表示する。 */
export function portfolioOptionAllowsQuantity(
  choice: Pick<PortfolioOptionChoice, "stableId">
): boolean {
  return choice.stableId === null || QUANTITY_OPTION_IDS.has(choice.stableId);
}

/**
 * 料金カードの「このプランで相談」を反映する。plan の stable ID が
 * request type / commission scope のどちらに対応するかだけを見て、
 * 未知の ID では何も変更しない。
 */
export function applyPortfolioPlanSelection(
  state: PortfolioRequestFormState,
  planId: string | null
): PortfolioRequestFormState {
  if (planId === "sd") {
    return pruneHiddenPortfolioRequestFields({ ...state, requestType: "sd" });
  }
  if (planId === "bust_up" || planId === "waist_up" || planId === "full_body") {
    return pruneHiddenPortfolioRequestFields({ ...state, commissionScope: planId });
  }
  return state;
}

/**
 * 条件付きで非表示になった入力の残留値を落とす。
 * 表示されていない値を送信しないことは、schema の conditional required と
 * 「other でないなら null」制約の両方を満たすために必要。
 */
export function pruneHiddenPortfolioRequestFields(
  state: PortfolioRequestFormState
): PortfolioRequestFormState {
  const budgetUsesRange = state.budgetKind === "range";
  const budgetUsesAmount = state.budgetKind === "range" || state.budgetKind === "fixed";
  const deadlineUsesDate =
    state.deadlineKind === "preferred_date" || state.deadlineKind === "rush_consultation";
  return {
    ...state,
    requestTypeOther: state.requestType === "other" ? state.requestTypeOther : "",
    commissionScopeOther:
      state.commissionScope === "other" ? state.commissionScopeOther : "",
    usageTypeOther: state.usageTypes.includes("other") ? state.usageTypeOther : "",
    publicationAllowedFrom:
      state.publicationPolicy === "delayed" ? state.publicationAllowedFrom : "",
    budgetMin: budgetUsesAmount ? state.budgetMin : "",
    budgetMax: budgetUsesRange ? state.budgetMax : "",
    deadlineDate: deadlineUsesDate ? state.deadlineDate : "",
  };
}

/** 未入力は NaN のまま返し、共有 schema 側で field error にする。 */
function parseAmount(value: string): number {
  const trimmed = value.trim();
  if (!/^\d{1,12}$/u.test(trimmed)) return Number.NaN;
  return Number(trimmed);
}

function buildBudget(state: PortfolioRequestFormState): NatoriBudgetV1 {
  switch (state.budgetKind) {
    case "undecided":
      return { kind: "undecided", min: null, max: null, currency: "JPY" };
    case "fixed": {
      const amount = parseAmount(state.budgetMin);
      return { kind: "fixed", min: amount, max: amount, currency: "JPY" };
    }
    case "range": {
      const max = state.budgetMax.trim() === "" ? null : parseAmount(state.budgetMax);
      return { kind: "range", min: parseAmount(state.budgetMin), max, currency: "JPY" };
    }
  }
}

function buildDeadline(state: PortfolioRequestFormState): NatoriDeadlineV1 {
  const note = state.deadlineNote.trim();
  switch (state.deadlineKind) {
    case "undecided":
    case "standard":
      return { kind: state.deadlineKind, date: null, note };
    case "preferred_date":
      return { kind: "preferred_date", date: state.deadlineDate.trim(), note };
    case "rush_consultation":
      return {
        kind: "rush_consultation",
        date: state.deadlineDate.trim() === "" ? null : state.deadlineDate.trim(),
        note,
      };
  }
}

/**
 * 選択済みオプションを stable ID + label snapshot + quantity + notes で組み立てる。
 * stable ID を持たない legacy 項目は「その他」1件へ集約し、label から ID を作らない。
 */
export function buildSelectedOptions(
  state: PortfolioRequestFormState,
  choices: PortfolioOptionChoice[]
): NatoriSelectedOptionV1[] {
  const options: NatoriSelectedOptionV1[] = [];
  const unmappedLabels: string[] = [];

  for (const choice of choices) {
    const selection = state.optionSelections[choice.key];
    if (!selection?.selected) continue;
    if (choice.stableId === null) {
      unmappedLabels.push(choice.label);
      continue;
    }
    options.push({
      id: choice.stableId,
      label: choice.label,
      quantity: Number.isInteger(selection.quantity) ? selection.quantity : 1,
      notes: selection.notes.trim().slice(0, OPTION_NOTES_MAX_LENGTH),
    });
  }

  if (unmappedLabels.length === 0) return options;

  const aggregated = unmappedLabels.join(" / ");
  const existing = options.find((option) => option.id === NATORI_OTHER_OPTION_ID);
  if (existing) {
    existing.notes = [existing.notes, aggregated]
      .filter((part) => part.length > 0)
      .join(" / ")
      .slice(0, OPTION_NOTES_MAX_LENGTH);
    return options;
  }
  options.push({
    id: NATORI_OTHER_OPTION_ID,
    label: OTHER_OPTION_LABEL,
    quantity: 1,
    notes: aggregated.slice(0, OPTION_NOTES_MAX_LENGTH),
  });
  return options;
}

/**
 * 入力 state から RequestData V1 を組み立てる。schemaVersion / formVersion /
 * legacySource は新フォーム固定値で、依頼者入力からは変更できない。
 */
export function buildNatoriRequestDataV1(
  rawState: PortfolioRequestFormState,
  choices: PortfolioOptionChoice[]
): NatoriRequestDataV1 {
  const state = pruneHiddenPortfolioRequestFields(rawState);
  const usageTypes = [...new Set(state.usageTypes)];
  return {
    schemaVersion: NATORI_REQUEST_SCHEMA_VERSION,
    formVersion: "etorie-request-v1",
    inquiryMode: state.inquiryMode,
    requestType: state.requestType,
    requestTypeOther:
      state.requestType === "other" ? state.requestTypeOther.trim() : null,
    commissionScope: state.commissionScope,
    commissionScopeOther:
      state.commissionScope === "other" ? state.commissionScopeOther.trim() : null,
    options: buildSelectedOptions(state, choices),
    usageTypes,
    usageTypeOther: usageTypes.includes("other") ? state.usageTypeOther.trim() : null,
    commercialUse: state.commercialUse,
    publicationPolicy: state.publicationPolicy,
    publicationAllowedFrom:
      state.publicationPolicy === "delayed"
        ? state.publicationAllowedFrom.trim() || null
        : null,
    budget: buildBudget(state),
    deadline: buildDeadline(state),
    characterFeatures: state.characterFeatures.trim(),
    expressionMood: state.expressionMood.trim(),
    composition: state.composition.trim(),
    colorDirection: state.colorDirection.trim(),
    referenceNotes: state.referenceNotes.trim(),
    message: state.message.trim(),
    legacySource: null,
  };
}

export type PortfolioReferenceLinkError = {
  index: number;
  message: string;
};

/** 空行を除いた送信対象の外部参照 URL。順序が sortOrder の基準になる。 */
export function submittedPortfolioReferenceLinks(
  rows: PortfolioReferenceLinkRow[]
): PortfolioReferenceLinkRow[] {
  return rows
    .map((row) => ({ url: row.url.trim(), label: row.label.trim() }))
    .filter((row) => row.url.length > 0)
    .slice(0, NATORI_MAX_REFERENCE_LINKS);
}

/**
 * 外部参照 URL の client 側 validation。UX 用であり、正規化と重複判定の真実源は
 * server（referenceLinks.ts）と RPC 側にある。URL へのアクセスは一切しない。
 */
export function collectPortfolioReferenceLinkErrors(
  rows: PortfolioReferenceLinkRow[]
): PortfolioReferenceLinkError[] {
  const errors: PortfolioReferenceLinkError[] = [];
  const seen = new Map<string, number>();

  rows.forEach((row, index) => {
    const url = row.url.trim();
    if (url.length === 0) return;
    if (url.length > NATORI_REFERENCE_LINK_MAX_LENGTH) {
      errors.push({ index, message: "URLが長すぎます。" });
      return;
    }
    const normalized = normalizeNatoriReferenceUrl(url);
    if (!normalized) {
      errors.push({
        index,
        message: "https:// で始まる URL を入力してください（ID・パスワード付きは不可）。",
      });
      return;
    }
    const duplicateOf = seen.get(normalized);
    if (duplicateOf !== undefined) {
      errors.push({
        index,
        message: `${duplicateOf + 1}行目と同じURLです。`,
      });
      return;
    }
    seen.set(normalized, index);
  });

  const filledRows = rows.filter((row) => row.url.trim().length > 0).length;
  if (filledRows > NATORI_MAX_REFERENCE_LINKS) {
    errors.push({
      index: NATORI_MAX_REFERENCE_LINKS,
      message: `URLは最大${NATORI_MAX_REFERENCE_LINKS}件までです。`,
    });
  }
  return errors;
}
