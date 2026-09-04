import { describe, expect, it } from "vitest";
import { createDefaultNatoriPricingConfig } from "@/features/natori/lib/pricing";
import {
  createStructuredSuggestionConfigFromLegacy,
  readStructuredPricingConfig,
  readVersionlessStructuredPricingConfig,
  withStructuredPricingConfig,
} from "@/features/natori/lib/pricingSuggestionConfig";
import { createNatoriEstimateSuggestionV1 } from "@/features/natori/lib/pricingSuggestion";
import type { NatoriRequestDataV1 } from "@/features/natori/types/request";

const requestData: NatoriRequestDataV1 = {
  schemaVersion: 1,
  formVersion: "etorie-request-v1",
  inquiryMode: "quote",
  requestType: "icon",
  requestTypeOther: null,
  commissionScope: "bust_up",
  commissionScopeOther: null,
  options: [],
  usageTypes: [],
  usageTypeOther: null,
  commercialUse: "none",
  publicationPolicy: "allowed",
  budget: { kind: "undecided", min: null, max: null, currency: "JPY" },
  deadline: { kind: "standard", date: null, note: "" },
  characterFeatures: "",
  expressionMood: "",
  composition: "",
  colorDirection: "",
  referenceNotes: "",
  message: "test",
  legacySource: null,
};

describe("structured pricing compatibility", () => {
  it("normalizes a valid versionless structured config to schemaVersion 1", () => {
    const versionless = {
      currency: "JPY",
      items: [{ id: "icon", kind: "base", label: "アイコン", amount: 4500 }],
    };

    expect(readVersionlessStructuredPricingConfig(versionless)).toEqual({
      schemaVersion: 1,
      ...versionless,
    });
  });

  it("rejects malformed versionless data instead of replacing it with guessed values", () => {
    expect(readVersionlessStructuredPricingConfig({ currency: "JPY", items: [{ id: "icon" }] })).toBeNull();
    expect(readVersionlessStructuredPricingConfig({ schemaVersion: 2, currency: "JPY", items: [] })).toBeNull();
  });

  it("preserves labels and amounts from stored structured pricing", () => {
    const legacy = createDefaultNatoriPricingConfig();
    const stored = {
      schemaVersion: 1 as const,
      currency: "JPY" as const,
      items: [{ id: "icon", kind: "base" as const, label: "SNS用アイコン", amount: 4800 }],
    };
    const combined = withStructuredPricingConfig(legacy, stored);

    expect(readStructuredPricingConfig(combined)).toEqual(stored);
    expect(createStructuredSuggestionConfigFromLegacy(combined)).toEqual(stored);
  });

  it("does not map scope-based legacy base prices to product base IDs", () => {
    const legacy = createDefaultNatoriPricingConfig();
    const config = createStructuredSuggestionConfigFromLegacy(legacy);
    const result = createNatoriEstimateSuggestionV1({
      projectType: "icon",
      requestData,
      pricingConfig: config,
    });

    expect(config.items.some((item) => item.kind === "base")).toBe(false);
    expect(result.automaticItems.filter((item) => item.kind === "base")).toHaveLength(0);
    expect(result.reviewItems).toContainEqual(
      expect.objectContaining({ code: "pricing_base_rule_missing", severity: "blocker" })
    );
    expect(result.canIssueQuote).toBe(false);
  });
});
