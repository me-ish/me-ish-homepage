import type {
  NatoriBaseItem,
  NatoriDetectedItem,
  NatoriEstimateLineItem,
  NatoriEstimateResult,
  NatoriFixedOption,
  NatoriPercentageOption,
  NatoriPricingKeyword,
  NatoriWarningRule,
} from "@/types/natori/pricing";

export const baseItems: readonly NatoriBaseItem[] = [
  {
    id: "icon",
    label: "アイコン",
    basePrice: 8000,
    priority: 10,
    keywords: ["アイコン", "icon", "SNS用", "プロフィール画像", "プロフィール", "丸アイコン"],
  },
  {
    id: "sd_character",
    label: "SDキャラ",
    basePrice: 15000,
    priority: 20,
    keywords: ["SD", "SDキャラ", "デフォルメ", "ちびキャラ", "ミニキャラ"],
  },
  {
    id: "standing",
    label: "立ち絵",
    basePrice: 30000,
    priority: 30,
    keywords: ["立ち絵", "全身", "キャラクター全身", "配信用", "TRPG"],
  },
  {
    id: "general",
    label: "通常イラスト",
    basePrice: 20000,
    priority: 1,
    keywords: ["イラスト", "一枚絵", "表紙", "サムネ", "グッズ"],
  },
];

export const fixedOptions: readonly NatoriFixedOption[] = [
  {
    id: "expression_variation",
    label: "表情差分",
    amount: 3000,
    keywords: ["表情差分", "差分", "笑顔", "怒り", "泣き顔", "表情追加"],
    question: "必要な表情差分の点数と、それぞれの内容を確認してください。",
  },
  {
    id: "background",
    label: "背景あり",
    amount: 8000,
    keywords: ["背景あり", "背景込み", "背景付き", "背景も", "風景", "室内", "屋外"],
    question: "背景の複雑さ、資料の有無、描き込み量を確認してください。",
  },
];

export const percentageOptions: readonly NatoriPercentageOption[] = [
  {
    id: "commercial_use",
    label: "商用利用",
    rate: 0.5,
    keywords: ["商用利用", "収益化", "販売", "グッズ化", "配信で使用", "広告", "同人誌"],
    question: "利用範囲、掲載媒体、販売物の種類、利用期間を確認してください。",
  },
  {
    id: "rush",
    label: "短納期",
    rate: 0.3,
    keywords: ["急ぎ", "短納期", "至急", "即日", "今週中", "明日", "なる早"],
    warning: "短納期はスケジュール確認後に追加料金またはお断りの判断が必要です。",
    question: "希望納期と、ラフ確認・修正確認に使える日数を確認してください。",
  },
  {
    id: "private_work",
    label: "実績非公開",
    rate: 0.2,
    keywords: ["実績非公開", "非公開", "公開不可", "ポートフォリオ掲載不可", "秘密"],
    warning: "実績非公開は制作実績として掲載できないため、追加料金の対象です。",
    question: "公開不可の範囲と、解禁可能日があるかを確認してください。",
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

export function createNatoriEstimate(sourceText: string): NatoriEstimateResult {
  const normalizedText = normalizeText(sourceText);
  const category = pickBaseItem(normalizedText);
  const detectedBase = createDetectedItem(category, normalizedText) ?? {
    id: category.id,
    label: category.label,
    matchedKeywords: [],
  };
  const detectedFixedOptions = findMatchingRules(fixedOptions, normalizedText);
  const detectedPercentageOptions = findMatchingRules(percentageOptions, normalizedText);
  const detectedWarningRules = findMatchingRules(warningRules, normalizedText);

  const baseLineItem: NatoriEstimateLineItem = {
    id: category.id,
    label: `${category.label} 基本料金`,
    amount: category.basePrice,
  };
  const fixedLineItems = detectedFixedOptions.map((option) => ({
    id: option.id,
    label: option.label,
    amount: option.amount,
  }));
  const subtotalBeforePercentage = sumLineItems([baseLineItem, ...fixedLineItems]);
  const percentageLineItems = detectedPercentageOptions.map((option) => ({
    id: option.id,
    label: option.label,
    amount: roundToHundreds(subtotalBeforePercentage * option.rate),
    note: `${Math.round(option.rate * 100)}%加算`,
  }));
  const lineItems = [baseLineItem, ...fixedLineItems, ...percentageLineItems];
  const total = sumLineItems(lineItems);
  const warnings = [
    ...detectedPercentageOptions.flatMap((option) => option.warning ? [option.warning] : []),
    ...detectedWarningRules.map((rule) => rule.warning),
  ];
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

function pickBaseItem(normalizedText: string): NatoriBaseItem {
  const matches = baseItems
    .map((item) => ({
      item,
      matchedKeywords: findMatchedKeywords(item.keywords, normalizedText),
    }))
    .filter((item) => item.matchedKeywords.length > 0);

  if (matches.length === 0) {
    return baseItems.find((item) => item.id === "general")!;
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
        "※短納期・非公開・権利まわりなど確認が必要な項目があります。",
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

