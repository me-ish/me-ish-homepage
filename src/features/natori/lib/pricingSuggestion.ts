import type { NatoriDeliveryPlan } from "@/features/natori/types/projects";
import type {
  CreateNatoriEstimateSuggestionInputV1,
  NatoriEstimateSuggestionV1,
  NatoriIgnoredFieldV1,
  NatoriPricingConfigV1,
  NatoriPricingItemV1,
  NatoriQuoteItemV1,
  NatoriReviewWarningV1,
} from "@/features/natori/types/pricingSuggestion";
import {
  NATORI_ESTIMATE_SUGGESTION_SCHEMA_VERSION,
  NATORI_PRICING_CONFIG_SCHEMA_VERSION,
  NATORI_PRICING_MAPPING_VERSION,
} from "@/features/natori/types/pricingSuggestion";

const FIXED_OPTION_IDS = new Set([
  "complex_prop",
  "mascot_prop",
  "expression_variation",
  "detailed_background",
  "retake_extra",
  "commercial_use",
]);

const PERCENTAGE_OPTION_IDS = new Set(["additional_character"]);
const COPYRIGHT_OPTION_IDS = new Set(["copyright_transfer"]);

export function readNatoriPricingConfigV1(value: unknown): NatoriPricingConfigV1 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const config = value as Record<string, unknown>;
  if (config.schemaVersion !== NATORI_PRICING_CONFIG_SCHEMA_VERSION) return null;
  if (config.currency !== "JPY" || !Array.isArray(config.items)) return null;

  const items: NatoriPricingItemV1[] = [];
  for (const rawItem of config.items) {
    if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) return null;
    const item = rawItem as Record<string, unknown>;
    if (typeof item.id !== "string" || item.id.length === 0) return null;
    if (item.kind !== "base" && item.kind !== "fixed" && item.kind !== "percentage") return null;
    if (typeof item.label !== "string" || item.label.length === 0) return null;
    if (item.amount !== undefined && (!Number.isSafeInteger(item.amount) || Number(item.amount) < 0)) return null;
    if (item.rate !== undefined && (typeof item.rate !== "number" || !Number.isFinite(item.rate) || item.rate < 0)) return null;
    if (item.kind === "percentage" && typeof item.rate !== "number") return null;
    if (item.kind !== "percentage" && !Number.isSafeInteger(item.amount)) return null;
    items.push({
      id: item.id,
      kind: item.kind,
      label: item.label,
      amount: item.amount as number | undefined,
      rate: item.rate as number | undefined,
      note: typeof item.note === "string" ? item.note : undefined,
    });
  }

  return {
    schemaVersion: NATORI_PRICING_CONFIG_SCHEMA_VERSION,
    currency: "JPY",
    items,
  };
}

export function createNatoriEstimateSuggestionV1(
  input: CreateNatoriEstimateSuggestionInputV1
): NatoriEstimateSuggestionV1 {
  const reviewItems: NatoriReviewWarningV1[] = [];
  const ignoredFields: NatoriIgnoredFieldV1[] = [];
  const automaticItems = new Map<string, NatoriQuoteItemV1>();
  const itemIndex = indexPricingItems(input.pricingConfig.items, reviewItems);

  let baseAmount = 0;
  if (input.projectType === "undecided") {
    reviewItems.push(warning(
      "project_type_unconfirmed",
      "blocker",
      "案件の商品種別が未確定です",
      "商品種別を確定してから基本料金を選択してください。",
      "project.type",
      "project-type-required"
    ));
  } else {
    const baseRule = itemIndex.get(input.projectType);
    if (!baseRule || baseRule.kind !== "base" || baseRule.amount === undefined) {
      reviewItems.push(warning(
        "pricing_base_rule_missing",
        "blocker",
        "基本料金ルールがありません",
        `料金プリセットに ${input.projectType} の基本料金を追加してください。`,
        "project.type",
        `base:${input.projectType}`
      ));
    } else {
      baseAmount = baseRule.amount;
      automaticItems.set(baseRule.id, quoteItem(baseRule, 1, baseRule.amount, "project.type", `base:${input.projectType}`));
    }
  }

  const optionQuantities = new Map<string, number>();
  for (const option of input.requestData.options) {
    optionQuantities.set(option.id, (optionQuantities.get(option.id) ?? 0) + option.quantity);
  }

  for (const [optionId, quantity] of optionQuantities) {
    if (COPYRIGHT_OPTION_IDS.has(optionId)) {
      reviewItems.push(warning(
        "copyright_transfer_requires_review",
        "blocker",
        "著作権譲渡の確認が必要です",
        "利用許諾で代替できるか確認し、必要な場合は個別見積してください。",
        "requestData.options",
        `option:${optionId}`
      ));
      continue;
    }

    if (!FIXED_OPTION_IDS.has(optionId) && !PERCENTAGE_OPTION_IDS.has(optionId)) {
      reviewItems.push(warning(
        "unknown_pricing_option",
        "attention",
        "自動料金化できないオプションがあります",
        `オプション ${optionId} を確認し、必要なら手動で明細へ追加してください。`,
        "requestData.options",
        `option:${optionId}`
      ));
      continue;
    }

    addRuleCandidate({ automaticItems, itemIndex, reviewItems, presetItemId: optionId, quantity, sourceField: "requestData.options", ruleId: `option:${optionId}`, baseAmount });
  }

  if (input.requestData.commercialUse === "yes") {
    addRuleCandidate({ automaticItems, itemIndex, reviewItems, presetItemId: "commercial_use", quantity: 1, sourceField: "requestData.commercialUse", ruleId: "commercial-use", baseAmount });
  } else if (input.requestData.commercialUse === "unknown") {
    reviewItems.push(warning(
      "commercial_use_unknown",
      "attention",
      "商用利用の有無が未確定です",
      "利用範囲を確認してください。",
      "requestData.commercialUse",
      "commercial-use-unknown"
    ));
  }

  if (input.requestData.publicationPolicy === "work_private") {
    addRuleCandidate({ automaticItems, itemIndex, reviewItems, presetItemId: "sample_usage_denied", quantity: 1, sourceField: "requestData.publicationPolicy", ruleId: "publication:work_private", baseAmount });
  } else if (input.requestData.publicationPolicy === "fully_private") {
    addRuleCandidate({ automaticItems, itemIndex, reviewItems, presetItemId: "private_work", quantity: 1, sourceField: "requestData.publicationPolicy", ruleId: "publication:fully_private", baseAmount });
  } else if (input.requestData.publicationPolicy === "unknown" || input.requestData.publicationPolicy === "delayed") {
    reviewItems.push(warning(
      "publication_policy_requires_review",
      "attention",
      "公開条件の確認が必要です",
      "実績掲載の可否と公開可能時期を確認してください。",
      "requestData.publicationPolicy",
      `publication:${input.requestData.publicationPolicy}`
    ));
  }

  const requestRush = input.requestData.deadline.kind === "rush_consultation";
  const planRush = isRushDeliveryPlan(input.deliveryPlan);
  if (requestRush || planRush) {
    addRuleCandidate({ automaticItems, itemIndex, reviewItems, presetItemId: "rush_delivery", quantity: 1, sourceField: requestRush ? "requestData.deadline" : "project.deliveryPlan", ruleId: requestRush ? "deadline:rush_consultation" : `delivery-plan:${input.deliveryPlan}`, baseAmount });
  }
  if (requestRush !== planRush && input.deliveryPlan !== undefined) {
    reviewItems.push(warning(
      "rush_condition_mismatch",
      "attention",
      "依頼内容と管理納期プランが一致していません",
      "希望納期と納期プランを確認してください。",
      "requestData.deadline",
      "rush-condition-mismatch"
    ));
  }

  if (input.requestData.requestType === "undecided" || input.requestData.requestType === "other") {
    reviewItems.push(warning(
      "request_type_requires_review",
      "attention",
      "依頼種類の確認が必要です",
      "依頼種類を正式な商品種別へ解決してください。",
      "requestData.requestType",
      `request-type:${input.requestData.requestType}`
    ));
  }
  if (input.requestData.commissionScope === "undecided" || input.requestData.commissionScope === "other") {
    reviewItems.push(warning(
      "commission_scope_requires_review",
      "attention",
      "制作範囲の確認が必要です",
      "制作範囲を確認してください。",
      "requestData.commissionScope",
      `commission-scope:${input.requestData.commissionScope}`
    ));
  }

  ignoredFields.push(
    { sourceField: "requestData.commissionScope", reason: "基本料金は商品種別を主キーとするため自動料金化しません。" },
    { sourceField: "requestData.usageTypes", reason: "用途は確認情報として保持し、用途だけでは自動加算しません。" },
    { sourceField: "requestData.budget", reason: "予算は料金候補の上限・下限として自動適用しません。" },
    { sourceField: "requestData.characterFeatures", reason: "自由記述は意味推論せず管理者が確認します。" },
    { sourceField: "requestData.expressionMood", reason: "自由記述は意味推論せず管理者が確認します。" },
    { sourceField: "requestData.composition", reason: "自由記述は意味推論せず管理者が確認します。" },
    { sourceField: "requestData.colorDirection", reason: "自由記述は意味推論せず管理者が確認します。" }
  );

  const items = Array.from(automaticItems.values());
  const subtotalBeforePercentage = items.filter((item) => item.kind !== "percentage").reduce((sum, item) => sum + item.amount, 0);
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return {
    schemaVersion: NATORI_ESTIMATE_SUGGESTION_SCHEMA_VERSION,
    mappingVersion: NATORI_PRICING_MAPPING_VERSION,
    pricingConfigVersion: NATORI_PRICING_CONFIG_SCHEMA_VERSION,
    automaticItems: items,
    reviewItems,
    ignoredFields,
    subtotalBeforePercentage,
    total,
    canIssueQuote: reviewItems.every((item) => item.severity !== "blocker"),
  };
}

function indexPricingItems(items: readonly NatoriPricingItemV1[], reviewItems: NatoriReviewWarningV1[]) {
  const index = new Map<string, NatoriPricingItemV1>();
  const duplicates = new Set<string>();
  for (const item of items) {
    if (index.has(item.id)) duplicates.add(item.id);
    else index.set(item.id, item);
  }
  for (const id of duplicates) {
    index.delete(id);
    reviewItems.push(warning(
      "duplicate_pricing_rule",
      "blocker",
      "料金プリセットに重複IDがあります",
      `${id} を1件に整理してください。`,
      "pricingConfig.items",
      `duplicate:${id}`
    ));
  }
  return index;
}

function addRuleCandidate(args: {
  automaticItems: Map<string, NatoriQuoteItemV1>;
  itemIndex: Map<string, NatoriPricingItemV1>;
  reviewItems: NatoriReviewWarningV1[];
  presetItemId: string;
  quantity: number;
  sourceField: string;
  ruleId: string;
  baseAmount: number;
}) {
  const rule = args.itemIndex.get(args.presetItemId);
  if (!rule) {
    args.reviewItems.push(warning(
      "pricing_rule_missing",
      "blocker",
      "料金ルールがありません",
      `${args.presetItemId} の料金ルールをプリセットへ追加してください。`,
      args.sourceField,
      args.ruleId
    ));
    return;
  }

  const existing = args.automaticItems.get(rule.id);
  if (existing) {
    existing.sourceFields = Array.from(new Set([...existing.sourceFields, args.sourceField]));
    return;
  }

  if (rule.kind === "percentage") {
    if (rule.rate === undefined || args.baseAmount <= 0) {
      args.reviewItems.push(warning(
        "percentage_rule_unusable",
        "blocker",
        "割合料金を計算できません",
        `${rule.label} の率と基本料金を確認してください。`,
        args.sourceField,
        args.ruleId
      ));
      return;
    }
    const unitAmount = roundToHundreds(args.baseAmount * rule.rate);
    args.automaticItems.set(rule.id, quoteItem(rule, args.quantity, unitAmount, args.sourceField, args.ruleId, args.baseAmount));
    return;
  }

  if (rule.amount === undefined) {
    args.reviewItems.push(warning(
      "fixed_rule_unusable",
      "blocker",
      "固定料金を計算できません",
      `${rule.label} の金額を確認してください。`,
      args.sourceField,
      args.ruleId
    ));
    return;
  }
  args.automaticItems.set(rule.id, quoteItem(rule, args.quantity, rule.amount, args.sourceField, args.ruleId));
}

function quoteItem(
  rule: NatoriPricingItemV1,
  quantity: number,
  unitAmount: number,
  sourceField: string,
  ruleId: string,
  baseAmount?: number
): NatoriQuoteItemV1 {
  return {
    id: `auto:${rule.id}`,
    presetItemId: rule.id,
    kind: rule.kind,
    labelSnapshot: rule.label,
    quantity,
    unitAmount,
    amount: unitAmount * quantity,
    sourceField,
    sourceFields: [sourceField],
    ruleId,
    automatic: true,
    rate: rule.rate,
    baseAmount,
    note: rule.note,
  };
}

function warning(
  code: string,
  severity: "blocker" | "attention",
  title: string,
  action: string,
  sourceField: string,
  ruleId: string
): NatoriReviewWarningV1 {
  return { code, severity, title, action, sourceField, ruleId };
}

function isRushDeliveryPlan(plan: NatoriDeliveryPlan | undefined): boolean {
  return plan === "rush_14_days" || plan === "rush_7_days";
}

function roundToHundreds(value: number): number {
  return Math.round(value / 100) * 100;
}
