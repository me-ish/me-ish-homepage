import type { NatoriRequestDataV1 } from "@/features/natori/types/request";
import type { NatoriConcreteProjectType } from "@/features/natori/types/projects";
import type { NatoriReviewWarningSeverityV1 } from "@/features/natori/types/pricingSuggestion";

export const NATORI_QUOTE_PRICING_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export type NatoriQuoteSnapshotItemKind =
  | "base"
  | "fixed"
  | "percentage"
  | "manual";

export type NatoriQuoteSnapshotItemV1 = {
  id: string;
  presetItemId: string | null;
  kind: NatoriQuoteSnapshotItemKind;
  labelSnapshot: string;
  quantity: number;
  unitAmount: number;
  amount: number;
  automatic: boolean;
  sourceFields: string[];
  ruleId: string | null;
  note: string | null;
};

export type NatoriQuoteReviewItemSnapshotV1 = {
  code: string;
  severity: NatoriReviewWarningSeverityV1;
  title: string;
  action: string;
  sourceField: string;
  ruleId: string;
};

export type NatoriQuoteReviewResolutionV1 = {
  code: string;
  ruleId: string;
  resolution: "accepted" | "overridden" | "not_applicable";
  note: string;
  resolvedAt: string;
};

export type NatoriQuotePricingSnapshotV1 = {
  schemaVersion: typeof NATORI_QUOTE_PRICING_SNAPSHOT_SCHEMA_VERSION;
  mappingVersion: string;
  pricingConfigVersion: number;
  pricingPresetId: string | null;
  pricingPresetNameSnapshot: string;
  projectTypeSnapshot: NatoriConcreteProjectType;
  items: NatoriQuoteSnapshotItemV1[];
  reviewItems: NatoriQuoteReviewItemSnapshotV1[];
  reviewResolutions: NatoriQuoteReviewResolutionV1[];
  subtotalBeforePercentage: number;
  total: number;
  currency: "JPY";
  issuedAt: string;
};

export type NatoriQuoteIssuePayloadV1 = {
  projectId: string;
  toEmail: string;
  subject: string;
  bodySnapshot: string;
  idempotencyKey: string;
  requestSnapshot: NatoriRequestDataV1 | null;
  pricingSnapshot: NatoriQuotePricingSnapshotV1;
};

export type NatoriQuoteSnapshotValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type NatoriQuoteSnapshotValidationResult =
  | { success: true; data: NatoriQuoteIssuePayloadV1 }
  | { success: false; issues: NatoriQuoteSnapshotValidationIssue[] };
