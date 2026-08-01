import type { NatoriPricingConfig } from "@/features/natori/types/pricing";
import type { NatoriPricingConfigV1 } from "@/features/natori/types/pricingSuggestion";

/**
 * 既存料金表から、stable ID がそのまま一致する加算項目だけをV1へ移す。
 * 既存の基本料金は scope 軸なので、商品種別の基本料金へ推測変換しない。
 * そのため structured 見積では pricing_base_rule_missing が明示される。
 */
export function createStructuredSuggestionConfigFromLegacy(
  legacy: NatoriPricingConfig
): NatoriPricingConfigV1 {
  return {
    schemaVersion: 1,
    currency: "JPY",
    items: [
      ...legacy.fixedOptions.map((option) => ({
        id: option.id,
        kind: "fixed" as const,
        label: option.label,
        amount: option.amount,
        note: option.note,
      })),
      ...legacy.percentageOptions.map((option) => ({
        id: option.id,
        kind: "percentage" as const,
        label: option.label,
        rate: option.rate,
        note: option.note,
      })),
    ],
  };
}
