import { readNatoriPricingConfigV1 } from "@/features/natori/lib/pricingSuggestion";
import type { NatoriPricingConfig } from "@/features/natori/types/pricing";
import type { NatoriPricingConfigV1 } from "@/features/natori/types/pricingSuggestion";

export type NatoriPricingConfigWithStructured = NatoriPricingConfig & {
  structuredPricing?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * P1-08以前に保存された、schemaVersionだけを持たないstructured料金を読む。
 * currency/itemsの内容検証はV1 readerへ委譲し、壊れた値や別shapeは採用しない。
 */
export function readVersionlessStructuredPricingConfig(
  value: unknown
): NatoriPricingConfigV1 | null {
  if (!isRecord(value) || value.schemaVersion !== undefined) return null;
  return readNatoriPricingConfigV1({ ...value, schemaVersion: 1 });
}

export function readStructuredPricingConfig(
  legacy: NatoriPricingConfigWithStructured
): NatoriPricingConfigV1 | null {
  return (
    readNatoriPricingConfigV1(legacy.structuredPricing) ??
    readVersionlessStructuredPricingConfig(legacy.structuredPricing)
  );
}

/**
 * 既存料金表から、stable ID が一致する加算項目だけをV1へ移す。
 * scope軸の基本料金は商品種別へ推測変換しない。
 */
export function createStructuredSuggestionConfigFromLegacy(
  legacy: NatoriPricingConfigWithStructured
): NatoriPricingConfigV1 {
  const stored = readStructuredPricingConfig(legacy);
  if (stored) return stored;
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

export function withStructuredPricingConfig(
  legacy: NatoriPricingConfigWithStructured,
  structuredPricing: NatoriPricingConfigV1
): NatoriPricingConfigWithStructured {
  return { ...legacy, structuredPricing };
}
