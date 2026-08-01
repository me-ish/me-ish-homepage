import type { NatoriConcreteProjectType, NatoriDeliveryPlan, NatoriProjectType } from "@/features/natori/types/projects";
import type { NatoriRequestDataV1 } from "@/features/natori/types/request";

export const NATORI_PRICING_CONFIG_SCHEMA_VERSION = 1 as const;
export const NATORI_PRICING_MAPPING_VERSION = "natori-pricing-mapping-v1" as const;
export const NATORI_ESTIMATE_SUGGESTION_SCHEMA_VERSION = 1 as const;

export type NatoriPricingItemKindV1 = "base" | "fixed" | "percentage";

export type NatoriPricingItemV1 = {
  id: string;
  kind: NatoriPricingItemKindV1;
  label: string;
  amount?: number;
  rate?: number;
  note?: string;
};

export type NatoriPricingConfigV1 = {
  schemaVersion: typeof NATORI_PRICING_CONFIG_SCHEMA_VERSION;
  currency: "JPY";
  items: NatoriPricingItemV1[];
};

export type NatoriQuoteItemV1 = {
  id: string;
  presetItemId: string;
  kind: NatoriPricingItemKindV1;
  labelSnapshot: string;
  quantity: number;
  unitAmount: number;
  amount: number;
  sourceField: string;
  sourceFields: string[];
  ruleId: string;
  automatic: true;
  rate?: number;
  baseAmount?: number;
  note?: string;
};

export type NatoriReviewWarningSeverityV1 = "blocker" | "attention";

export type NatoriReviewWarningV1 = {
  code: string;
  severity: NatoriReviewWarningSeverityV1;
  title: string;
  action: string;
  sourceField: string;
  ruleId: string;
};

export type NatoriIgnoredFieldV1 = {
  sourceField: string;
  reason: string;
};

export type NatoriEstimateSuggestionV1 = {
  schemaVersion: typeof NATORI_ESTIMATE_SUGGESTION_SCHEMA_VERSION;
  mappingVersion: typeof NATORI_PRICING_MAPPING_VERSION;
  pricingConfigVersion: typeof NATORI_PRICING_CONFIG_SCHEMA_VERSION;
  automaticItems: NatoriQuoteItemV1[];
  reviewItems: NatoriReviewWarningV1[];
  ignoredFields: NatoriIgnoredFieldV1[];
  subtotalBeforePercentage: number;
  total: number;
  canIssueQuote: boolean;
};

export type CreateNatoriEstimateSuggestionInputV1 = {
  projectType: NatoriProjectType;
  requestData: NatoriRequestDataV1;
  deliveryPlan?: NatoriDeliveryPlan;
  pricingConfig: NatoriPricingConfigV1;
};

export const NATORI_BASE_PRICING_ITEM_IDS = [
  "icon",
  "sd",
  "standing",
  "illustration",
] as const satisfies readonly NatoriConcreteProjectType[];
