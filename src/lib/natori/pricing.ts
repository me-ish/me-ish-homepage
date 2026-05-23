import { getDeliveryPlanMeta } from "@/lib/natori/deliveryPlans";
import type { NatoriDeliveryPlan } from "@/types/natori/projects";
import type {
  NatoriBaseItem,
  NatoriDetectedItem,
  NatoriEstimateLineItem,
  NatoriEstimateResult,
  NatoriFixedOption,
  NatoriPercentageOption,
  NatoriPricingConfig,
  NatoriPricingKeyword,
  NatoriWarningRule,
} from "@/types/natori/pricing";

export type NatoriEstimateOptions = {
  deliveryPlan?: NatoriDeliveryPlan;
};

export const baseItems: readonly NatoriBaseItem[] = [
  {
    id: "bust_up",
    label: "胸上",
    basePrice: 4000,
    priority: 10,
    note: "リテイク2回まで無料。簡単な小物、簡易背景無料。",
    keywords: ["胸上", "バストアップ", "肩上", "顔アップ", "アイコン", "icon", "SNS用"],
  },
  {
    id: "waist_up",
    label: "膝〜腰上",
    basePrice: 6000,
    priority: 20,
    note: "リテイク2回まで無料。簡単な小物、簡易背景無料。",
    keywords: ["膝", "腰上", "腰まで", "膝上", "半身"],
  },
  {
    id: "full_body",
    label: "全身",
    basePrice: 10000,
    priority: 30,
    note: "リテイク2回まで無料。簡単な小物、簡易背景無料。",
    keywords: ["全身", "立ち絵", "キャラクター全身", "配信用", "TRPG"],
  },
];

export const fixedOptions: readonly NatoriFixedOption[] = [
  {
    id: "complex_prop",
    label: "複雑な小物追加",
    amount: 500,
    keywords: ["複雑な小物", "小物追加", "武器", "楽器", "装飾品"],
    question: "追加したい小物の資料と複雑さを確認してください。",
  },
  {
    id: "mascot_prop",
    label: "ぬいぐるみ／マスコット追加",
    amount: 500,
    keywords: ["ぬいぐるみ", "マスコット", "ぬい", "ペット", "相棒キャラ"],
    question: "追加するぬいぐるみ・マスコットの資料を確認してください。",
  },
  {
    id: "expression_variation",
    label: "表情差分",
    amount: 500,
    keywords: ["表情差分", "差分", "笑顔", "怒り", "泣き顔", "表情追加"],
    question: "必要な表情差分の点数と、それぞれの内容を確認してください。",
  },
  {
    id: "detailed_background",
    label: "しっかり背景",
    amount: 3000,
    note: "内容により5,000円まで調整",
    keywords: ["しっかり背景", "背景あり", "背景込み", "背景付き", "風景", "室内", "屋外"],
    question: "背景の複雑さ、資料の有無、描き込み量を確認してください。",
  },
  {
    id: "commercial_use",
    label: "商用利用",
    amount: 3000,
    keywords: ["商用利用", "収益化", "販売", "グッズ化", "配信で使用", "広告", "同人誌"],
    question: "利用範囲、掲載媒体、販売物の種類、利用期間を確認してください。",
  },
  {
    id: "sample_usage_denied",
    label: "サンプル使用不可",
    amount: 1000,
    keywords: ["サンプル使用不可", "サンプル不可", "実績掲載不可", "ポートフォリオ掲載不可"],
    question: "サンプル使用不可の範囲と、解禁可能日があるかを確認してください。",
  },
  {
    id: "private_work",
    label: "完全非公開",
    amount: 2000,
    keywords: ["完全非公開", "非公開", "公開不可", "秘密"],
    question: "完全非公開が必要な理由と公開不可の範囲を確認してください。",
  },
  {
    id: "rush_delivery",
    label: "お急ぎ納品",
    amount: 2000,
    keywords: ["急ぎ", "お急ぎ", "短納期", "至急", "即日", "今週中", "明日", "なる早"],
    question: "希望納期と、ラフ確認・修正確認に使える日数を確認してください。",
  },
  {
    id: "retake_extra",
    label: "リテイク3回目以降",
    amount: 500,
    note: "1回あたり",
    keywords: ["リテイク3回", "リテイク三回", "修正3回", "修正三回", "追加修正"],
    question: "リテイク回数が3回以上になる可能性があるか確認してください。",
  },
];

export const percentageOptions: readonly NatoriPercentageOption[] = [
  {
    id: "additional_character",
    label: "人物追加",
    rate: 0.7,
    keywords: ["人物追加", "キャラ追加", "追加キャラ", "2人", "二人", "複数人", "ペア"],
    question: "追加する人物の人数、構図、資料を確認してください。",
  },
];

export const warningRules: readonly NatoriWarningRule[] = [
  {
    id: "copyright_transfer",
    label: "著作権譲渡",
    keywords: ["著作権譲渡", "著作権を譲渡", "権利譲渡", "買い取り", "買取"],
    warning: "著作権譲渡は通常料金表の対象外です。利用許諾で足りるかを先に確認してください。",
    question: "著作権譲渡が本当に必要か、利用許諾で代替できるかを確認してください。",
  },
];

const DEFAULT_QUESTIONS = [
  "希望納期を確認してください。",
  "使用用途と公開先を確認してください。",
  "画像サイズ、納品形式、透過PNGの要否を確認してください。",
  "修正回数とラフ確認のタイミングを確認してください。",
] as const;

export const defaultNatoriPricingConfig: NatoriPricingConfig = {
  baseItems: baseItems.map((item) => ({ ...item, keywords: [...item.keywords] })),
  fixedOptions: fixedOptions.map((option) => ({ ...option, keywords: [...option.keywords] })),
  percentageOptions: percentageOptions.map((option) => ({ ...option, keywords: [...option.keywords] })),
  warningRules: warningRules.map((rule) => ({ ...rule, keywords: [...rule.keywords] })),
};

export function createDefaultNatoriPricingConfig(): NatoriPricingConfig {
  return {
    baseItems: defaultNatoriPricingConfig.baseItems.map((item) => ({ ...item, keywords: [...item.keywords] })),
    fixedOptions: defaultNatoriPricingConfig.fixedOptions.map((option) => ({
      ...option,
      keywords: [...option.keywords],
    })),
    percentageOptions: defaultNatoriPricingConfig.percentageOptions.map((option) => ({
      ...option,
      keywords: [...option.keywords],
    })),
    warningRules: defaultNatoriPricingConfig.warningRules.map((rule) => ({ ...rule, keywords: [...rule.keywords] })),
  };
}

export function createNatoriEstimate(
  sourceText: string,
  pricingConfig: NatoriPricingConfig = defaultNatoriPricingConfig,
  options: NatoriEstimateOptions = {}
): NatoriEstimateResult {
  const normalizedText = normalizeText(sourceText);
  const category = pickBaseItem(normalizedText, pricingConfig);
  const detectedBase = createDetectedItem(category, normalizedText) ?? {
    id: category.id,
    label: category.label,
    matchedKeywords: [],
  };
  const deliveryPlanMeta = options.deliveryPlan ? getDeliveryPlanMeta(options.deliveryPlan) : null;
  const explicitRushPlan = deliveryPlanMeta?.isRush ?? false;

  const detectedFixedOptionsRaw = findMatchingRules(pricingConfig.fixedOptions, normalizedText);
  // When a rush deliveryPlan is explicitly selected, the plan supplies the rush surcharge — drop the keyword-detected rush_delivery line to avoid double-counting.
  const detectedFixedOptions = explicitRushPlan
    ? detectedFixedOptionsRaw.filter((option) => option.id !== "rush_delivery")
    : detectedFixedOptionsRaw;
  const detectedPercentageOptions = findMatchingRules(pricingConfig.percentageOptions, normalizedText);
  const detectedWarningRules = findMatchingRules(pricingConfig.warningRules, normalizedText);

  const baseLineItem: NatoriEstimateLineItem = {
    id: category.id,
    label: `${category.label} 基本料金`,
    amount: category.basePrice,
    note: category.note,
  };
  const fixedLineItems: NatoriEstimateLineItem[] = detectedFixedOptions.map((option) => ({
    id: option.id,
    label: option.label,
    amount: option.amount,
    note: option.note,
  }));
  if (deliveryPlanMeta && deliveryPlanMeta.extraFee > 0) {
    fixedLineItems.push({
      id: `delivery_plan_${deliveryPlanMeta.id}`,
      label: deliveryPlanMeta.label,
      amount: deliveryPlanMeta.extraFee,
      note: `納期目安 ${deliveryPlanMeta.description}`,
    });
  }
  const subtotalBeforePercentage = sumLineItems([baseLineItem, ...fixedLineItems]);
  const percentageLineItems = detectedPercentageOptions.map((option) => ({
    id: option.id,
    label: option.label,
    amount: roundToHundreds(category.basePrice * option.rate),
    note: `${Math.round(option.rate * 100)}%加算（基本料金基準）`,
  }));
  const lineItems = [baseLineItem, ...fixedLineItems, ...percentageLineItems];
  const total = sumLineItems(lineItems);
  const warnings = detectedWarningRules.map((rule) => rule.warning);
  const questions = createQuestions(detectedFixedOptions, detectedPercentageOptions, detectedWarningRules);

  return {
    sourceText,
    category,
    detectedItems: [
      detectedBase,
      ...detectedFixedOptions.map((option) => createDetectedItem(option, normalizedText)!),
      ...detectedPercentageOptions.map((option) => createDetectedItem(option, normalizedText)!),
      ...detectedWarningRules.map((rule) => createDetectedItem(rule, normalizedText)!),
    ],
    breakdown: {
      base: baseLineItem,
      fixed: fixedLineItems,
      percentage: percentageLineItems,
    },
    lineItems,
    subtotalBeforePercentage,
    total,
    warnings,
    questions,
    replyDraft: createReplyDraft(category.label, total, questions, warnings),
  };
}

function pickBaseItem(normalizedText: string, pricingConfig: NatoriPricingConfig): NatoriBaseItem {
  const matches = pricingConfig.baseItems
    .map((item) => ({
      item,
      matchedKeywords: findMatchedKeywords(item.keywords, normalizedText),
    }))
    .filter((item) => item.matchedKeywords.length > 0);

  if (matches.length === 0) {
    return pricingConfig.baseItems.find((item) => item.id === "bust_up")!;
  }

  return matches.sort((a, b) => b.item.priority - a.item.priority)[0].item;
}

function findMatchingRules<T extends NatoriPricingKeyword>(
  rules: readonly T[],
  normalizedText: string
): T[] {
  return rules.filter((rule) => findMatchedKeywords(rule.keywords, normalizedText).length > 0);
}

function createDetectedItem<T extends NatoriPricingKeyword & { id: NatoriDetectedItem["id"] }>(
  item: T,
  normalizedText: string
): NatoriDetectedItem | null {
  const matchedKeywords = findMatchedKeywords(item.keywords, normalizedText);
  if (matchedKeywords.length === 0) return null;

  return {
    id: item.id,
    label: item.label,
    matchedKeywords,
  };
}

function findMatchedKeywords(keywords: readonly string[], normalizedText: string): string[] {
  return keywords.filter((keyword) => normalizedText.includes(normalizeText(keyword)));
}

function createQuestions(
  matchedFixed: readonly NatoriFixedOption[],
  matchedPercentage: readonly NatoriPercentageOption[],
  matchedWarnings: readonly NatoriWarningRule[]
): string[] {
  const optionQuestions = [...matchedFixed, ...matchedPercentage, ...matchedWarnings].flatMap((rule) =>
    rule.question ? [rule.question] : []
  );
  return Array.from(new Set([...optionQuestions, ...DEFAULT_QUESTIONS]));
}

function createReplyDraft(
  categoryLabel: string,
  total: number,
  questions: readonly string[],
  warnings: readonly string[]
): string {
  const warningText = warnings.length > 0
    ? [
        "",
        "※権利まわりなど確認が必要な項目があります。",
        "内容によっては追加料金、条件調整、またはお受けできない可能性があります。",
      ].join("\n")
    : "";

  return [
    "ご相談ありがとうございます。",
    "",
    `いただいた内容ですと、${categoryLabel}として概算 ${formatYen(total)} 前後からのご案内になりそうです。`,
    "こちらは依頼文から料金表をもとにした概算のため、正式料金は詳細確認後に確定します。",
    "",
    "正式なお見積もりのため、下記を確認させてください。",
    ...questions.slice(0, 6).map((question) => `・${question}`),
    warningText,
    "",
    "内容を確認でき次第、制作可否と正式なお見積もり、スケジュールをご返信します。",
  ].filter(Boolean).join("\n");
}

function sumLineItems(lineItems: readonly NatoriEstimateLineItem[]): number {
  return lineItems.reduce((sum, item) => sum + item.amount, 0);
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").toLowerCase();
}

function roundToHundreds(value: number): number {
  return Math.round(value / 100) * 100;
}

export function formatYen(value: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

