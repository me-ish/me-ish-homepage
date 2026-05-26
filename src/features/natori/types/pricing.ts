export type NatoriEstimateCategory =
  | "bust_up"
  | "waist_up"
  | "full_body";

export type NatoriFixedOptionId =
  | "complex_prop"
  | "mascot_prop"
  | "expression_variation"
  | "detailed_background"
  | "commercial_use"
  | "sample_usage_denied"
  | "private_work"
  | "rush_delivery"
  | "retake_extra";

export type NatoriPercentageOptionId =
  | "additional_character";

export type NatoriWarningRuleId =
  | "copyright_transfer";

export type NatoriPricingRuleId =
  | NatoriEstimateCategory
  | NatoriFixedOptionId
  | NatoriPercentageOptionId
  | NatoriWarningRuleId;

export type NatoriPricingKeyword = {
  label: string;
  keywords: readonly string[];
};

export type NatoriBaseItem = NatoriPricingKeyword & {
  id: NatoriEstimateCategory;
  basePrice: number;
  priority: number;
  note?: string;
};

export type NatoriFixedOption = NatoriPricingKeyword & {
  id: NatoriFixedOptionId;
  amount: number;
  note?: string;
  question?: string;
};

export type NatoriPercentageOption = NatoriPricingKeyword & {
  id: NatoriPercentageOptionId;
  rate: number;
  note?: string;
  warning?: string;
  question?: string;
};

export type NatoriWarningRule = NatoriPricingKeyword & {
  id: NatoriWarningRuleId;
  warning: string;
  question?: string;
};

export type NatoriPricingConfig = {
  baseItems: NatoriBaseItem[];
  fixedOptions: NatoriFixedOption[];
  percentageOptions: NatoriPercentageOption[];
  warningRules: NatoriWarningRule[];
};

export type NatoriDetectedItem = {
  id: NatoriPricingRuleId;
  label: string;
  matchedKeywords: string[];
};

export type NatoriEstimateLineItem = {
  id: string;
  label: string;
  amount: number;
  note?: string;
};

export type NatoriEstimateBreakdown = {
  base: NatoriEstimateLineItem;
  fixed: NatoriEstimateLineItem[];
  percentage: NatoriEstimateLineItem[];
};

export type NatoriEstimateResult = {
  sourceText: string;
  category: NatoriBaseItem;
  detectedItems: NatoriDetectedItem[];
  breakdown: NatoriEstimateBreakdown;
  lineItems: NatoriEstimateLineItem[];
  subtotalBeforePercentage: number;
  total: number;
  warnings: string[];
  questions: string[];
  replyDraft: string;
};

