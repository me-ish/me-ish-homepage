// features/natori/lib/portfolioPricing.ts
// 公開ポートフォリオに表示している料金から structured 見積用 config を生成する純関数。
// ラベルや配列位置ではなく stable ID だけを使い、読めない表示価格は黙って推測しない。
import {
  MASS_PRODUCTION_OPTIONS,
} from "@/features/natori/constants/massProductionIllustration";
import {
  NATORI_MASS_PRODUCTION_BASE_AMOUNT,
  NATORI_RETAKE_EXTRA_AMOUNT,
  NATORI_RUSH_DELIVERY_AMOUNT,
} from "@/features/natori/constants/portfolioPricing";
import type { PortfolioContent } from "@/features/natori/types/portfolio";
import type {
  NatoriPricingConfigV1,
  NatoriPricingItemV1,
} from "@/features/natori/types/pricingSuggestion";
import { NATORI_PRICING_CONFIG_SCHEMA_VERSION } from "@/features/natori/types/pricingSuggestion";

function parseYenAmount(value: string): number | null {
  const match = value.trim().match(/^\+?([0-9][0-9,]*)円$/u);
  if (!match) return null;
  const amount = Number(match[1].replaceAll(",", ""));
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

function parseYenRange(value: string): { min: number; max: number } | null {
  const match = value
    .trim()
    .match(/^\+?([0-9][0-9,]*)円[〜~-]\+?([0-9][0-9,]*)円$/u);
  if (!match) return null;
  const min = Number(match[1].replaceAll(",", ""));
  const max = Number(match[2].replaceAll(",", ""));
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min < 0 || max < min) {
    return null;
  }
  return { min, max };
}

function parsePercentageRate(value: string): number | null {
  const match = value.trim().match(/^基本料金の\+?([0-9]+(?:\.[0-9]+)?)%$/u);
  if (!match) return null;
  const percent = Number(match[1]);
  if (!Number.isFinite(percent) || percent < 0) return null;
  return percent / 100;
}

function findPlan(content: PortfolioContent, id: string) {
  return content.plans.find((plan) => plan.id === id);
}

function findOption(content: PortfolioContent, id: string) {
  return content.options.find((option) => option.id === id);
}

function pushBaseFromPlan(
  items: NatoriPricingItemV1[],
  content: PortfolioContent,
  id: "sd" | "bust_up" | "waist_up" | "full_body",
  fallbackLabel: string
) {
  const plan = findPlan(content, id);
  if (!plan) return;
  const amount = parseYenAmount(plan.price);
  if (amount === null) return;
  items.push({ id, kind: "base", label: plan.name.trim() || fallbackLabel, amount });
}

function pushFixedFromOption(
  items: NatoriPricingItemV1[],
  content: PortfolioContent,
  id: string
) {
  const option = findOption(content, id);
  if (!option) return;
  const amount = parseYenAmount(option.price);
  if (amount === null) return;
  items.push({ id, kind: "fixed", label: option.name.trim() || id, amount });
}

/**
 * 自サイト依頼の料金は、この config を公開 PortfolioContent から毎回生成して使う。
 * つなぐ/VGen 等の外部プリセットとは分離する。
 */
export function createPortfolioStructuredPricingConfig(
  content: PortfolioContent
): NatoriPricingConfigV1 {
  const items: NatoriPricingItemV1[] = [];

  pushBaseFromPlan(items, content, "sd", "SD");
  pushBaseFromPlan(items, content, "bust_up", "胸上");
  pushBaseFromPlan(items, content, "waist_up", "膝〜腰上");
  pushBaseFromPlan(items, content, "full_body", "全身");

  items.push({
    id: "mass_production_illustration",
    kind: "base",
    label: "量産イラスト",
    amount: NATORI_MASS_PRODUCTION_BASE_AMOUNT,
  });

  pushFixedFromOption(items, content, "complex_prop");
  pushFixedFromOption(items, content, "mascot_prop");
  pushFixedFromOption(items, content, "expression_variation");

  const background = findOption(content, "detailed_background");
  if (background) {
    const range = parseYenRange(background.price);
    if (range) {
      items.push({
        id: "detailed_background",
        kind: "fixed",
        label: background.name.trim() || "しっかり背景",
        amount: range.min,
        note: `公開料金 ${background.price}。内容に応じて${range.max.toLocaleString("ja-JP")}円まで調整`,
      });
    } else {
      const amount = parseYenAmount(background.price);
      if (amount !== null) {
        items.push({
          id: "detailed_background",
          kind: "fixed",
          label: background.name.trim() || "しっかり背景",
          amount,
        });
      }
    }
  }

  const additionalCharacter = findOption(content, "additional_character");
  if (additionalCharacter) {
    const rate = parsePercentageRate(additionalCharacter.price);
    if (rate !== null) {
      items.push({
        id: "additional_character",
        kind: "percentage",
        label: additionalCharacter.name.trim() || "人物追加",
        rate,
      });
    }
  }

  pushFixedFromOption(items, content, "commercial_use");
  pushFixedFromOption(items, content, "sample_usage_denied");
  pushFixedFromOption(items, content, "private_work");

  items.push(
    {
      id: "rush_delivery",
      kind: "fixed",
      label: "お急ぎ納品",
      amount: NATORI_RUSH_DELIVERY_AMOUNT,
      note: "対応可否はスケジュール確認が必要",
    },
    {
      id: "retake_extra",
      kind: "fixed",
      label: "リテイク3回目以降",
      amount: NATORI_RETAKE_EXTRA_AMOUNT,
      note: "1回あたり",
    },
    ...MASS_PRODUCTION_OPTIONS.map((option) => ({
      id: option.id,
      kind: "fixed" as const,
      label: option.label,
      amount: option.amount,
    }))
  );

  return {
    schemaVersion: NATORI_PRICING_CONFIG_SCHEMA_VERSION,
    currency: "JPY",
    items,
  };
}
