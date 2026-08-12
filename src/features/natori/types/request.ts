// features/natori/types/request.ts
// Etorie/Natori の依頼原回答 contract。DB・HTTP に依存しない純粋な型だけを置く。

export const NATORI_REQUEST_SCHEMA_VERSION = 1 as const;

export type NatoriInquiryModeV1 = "consultation" | "quote";

export const NATORI_REQUEST_TYPES_V1 = [
  "undecided",
  "icon",
  "sd",
  "standing",
  "illustration",
  "other",
] as const;
export type NatoriRequestTypeV1 = (typeof NATORI_REQUEST_TYPES_V1)[number];

export type NatoriConcreteRequestTypeV1 = Exclude<NatoriRequestTypeV1, "undecided">;
export const NATORI_CONCRETE_REQUEST_TYPES_V1 = [
  "icon",
  "sd",
  "standing",
  "illustration",
  "other",
] as const satisfies readonly NatoriConcreteRequestTypeV1[];

export const NATORI_COMMISSION_SCOPES_V1 = [
  "undecided",
  "bust_up",
  "waist_up",
  "full_body",
  "other",
] as const;
export type NatoriCommissionScopeV1 = (typeof NATORI_COMMISSION_SCOPES_V1)[number];

export type NatoriConcreteCommissionScopeV1 = Exclude<
  NatoriCommissionScopeV1,
  "undecided"
>;
export const NATORI_CONCRETE_COMMISSION_SCOPES_V1 = [
  "bust_up",
  "waist_up",
  "full_body",
  "other",
] as const satisfies readonly NatoriConcreteCommissionScopeV1[];

export const NATORI_USAGE_TYPES_V1 = [
  "social_icon",
  "streaming",
  "video_thumbnail",
  "trpg",
  "original_character",
  "print",
  "merchandise",
  "advertising",
  "other",
] as const;
export type NatoriUsageTypeV1 = (typeof NATORI_USAGE_TYPES_V1)[number];

export type NatoriSelectedOptionV1 = {
  /** 料金設定またはフォーム設定内で不変の ID。 */
  id: string;
  /** 依頼者が送信時に見た表示名の snapshot。 */
  label: string;
  quantity: number;
  notes: string;
};

export type NatoriBudgetV1 =
  | {
      kind: "undecided";
      min: null;
      max: null;
      currency: "JPY";
    }
  | {
      kind: "range";
      min: number;
      max: number | null;
      currency: "JPY";
    }
  | {
      kind: "fixed";
      min: number;
      max: number;
      currency: "JPY";
    };

export type NatoriDeadlineV1 =
  | {
      kind: "undecided" | "standard";
      date: null;
      note: string;
    }
  | {
      kind: "preferred_date";
      date: string;
      note: string;
    }
  | {
      kind: "rush_consultation";
      date: string | null;
      note: string;
    };

export type NatoriLegacyRequestSourceV1 = {
  formVersion: "natori-portfolio-v1";
  requestTypeLabel: string;
  planLabel: string;
  optionLabels: string[];
  budgetLabel: string;
  deadlineLabel: string;
  referenceUrlsText: string;
  details: string;
  message: string;
};

type NatoriRequestDataV1Base = {
  schemaVersion: typeof NATORI_REQUEST_SCHEMA_VERSION;
  formVersion: "etorie-request-v1" | "natori-portfolio-v1";
  options: NatoriSelectedOptionV1[];
  usageTypes: NatoriUsageTypeV1[];
  usageTypeOther: string | null;
  commercialUse: "none" | "yes" | "unknown";
  publicationPolicy:
    | "allowed"
    | "delayed"
    | "work_private"
    | "fully_private"
    | "unknown";
  /** delayed のときの公開可能日。導入前データとの互換性のため省略可。 */
  publicationAllowedFrom?: string | null;
  budget: NatoriBudgetV1;
  deadline: NatoriDeadlineV1;
  characterFeatures: string;
  expressionMood: string;
  composition: string;
  colorDirection: string;
  referenceNotes: string;
  message: string;
  legacySource: NatoriLegacyRequestSourceV1 | null;
};

export type NatoriConsultationRequestDataV1 = NatoriRequestDataV1Base & {
  inquiryMode: "consultation";
  requestType: NatoriRequestTypeV1;
  requestTypeOther: string | null;
  commissionScope: NatoriCommissionScopeV1;
  commissionScopeOther: string | null;
};

export type NatoriQuoteRequestDataV1 = NatoriRequestDataV1Base & {
  inquiryMode: "quote";
  requestType: NatoriRequestTypeV1;
  requestTypeOther: string | null;
  commissionScope: NatoriCommissionScopeV1;
  commissionScopeOther: string | null;
};

/** inquiryMode を discriminant にした V1 contract。 */
export type NatoriRequestDataV1 =
  | NatoriConsultationRequestDataV1
  | NatoriQuoteRequestDataV1;

/** 氏名・連絡先は request_data に複製せず、案件の通常列へ保存する。 */
export type NatoriRequestSubmissionV1 = {
  clientName: string;
  clientEmail: string;
  requestData: NatoriRequestDataV1;
};

/** 将来 V2 を追加するときはこの union と reader の switch を同時に更新する。 */
export type NatoriVersionedRequestData = NatoriRequestDataV1;
