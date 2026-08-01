import { describe, expect, it } from "vitest";
import { createNatoriEstimateSuggestionV1, readNatoriPricingConfigV1 } from "@/features/natori/lib/pricingSuggestion";
import type { NatoriRequestDataV1 } from "@/features/natori/types/request";
import type { NatoriPricingConfigV1 } from "@/features/natori/types/pricingSuggestion";

const pricingConfig: NatoriPricingConfigV1 = {
  schemaVersion: 1,
  currency: "JPY",
  items: [
    { id: "icon", kind: "base", label: "アイコン", amount: 4000 },
    { id: "sd", kind: "base", label: "SD", amount: 5000 },
    { id: "standing", kind: "base", label: "立ち絵", amount: 10000 },
    { id: "illustration", kind: "base", label: "一枚絵", amount: 12000 },
    { id: "expression_variation", kind: "fixed", label: "表情差分", amount: 500 },
    { id: "commercial_use", kind: "fixed", label: "商用利用", amount: 3000 },
    { id: "private_work", kind: "fixed", label: "完全非公開", amount: 2000 },
    { id: "rush_delivery", kind: "fixed", label: "お急ぎ納品", amount: 2000 },
    { id: "additional_character", kind: "percentage", label: "人物追加", rate: 0.7 },
  ],
};

function request(overrides: Partial<NatoriRequestDataV1> = {}): NatoriRequestDataV1 {
  return {
    schemaVersion: 1,
    formVersion: "etorie-request-v1",
    inquiryMode: "quote",
    requestType: "standing",
    requestTypeOther: null,
    commissionScope: "full_body",
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
    ...overrides,
  } as NatoriRequestDataV1;
}

describe("createNatoriEstimateSuggestionV1", () => {
  it("uses project type stable ID instead of commission scope", () => {
    const result = createNatoriEstimateSuggestionV1({
      projectType: "icon",
      requestData: request({ commissionScope: "full_body" }),
      pricingConfig,
    });

    expect(result.automaticItems[0]).toMatchObject({
      presetItemId: "icon",
      amount: 4000,
      sourceField: "project.type",
      ruleId: "base:icon",
    });
    expect(result.automaticItems.map((item) => item.presetItemId)).not.toContain("standing");
  });

  it("does not silently select a base rule when project type is undecided", () => {
    const result = createNatoriEstimateSuggestionV1({
      projectType: "undecided",
      requestData: request(),
      pricingConfig,
    });

    expect(result.automaticItems.filter((item) => item.kind === "base")).toHaveLength(0);
    expect(result.reviewItems).toContainEqual(expect.objectContaining({ code: "project_type_unconfirmed", severity: "blocker" }));
    expect(result.canIssueQuote).toBe(false);
  });

  it("deduplicates field and option paths for the same item", () => {
    const result = createNatoriEstimateSuggestionV1({
      projectType: "standing",
      requestData: request({
        commercialUse: "yes",
        options: [{ id: "commercial_use", label: "別名でもIDは同じ", quantity: 1, notes: "" }],
      }),
      pricingConfig,
    });

    const commercial = result.automaticItems.filter((item) => item.presetItemId === "commercial_use");
    expect(commercial).toHaveLength(1);
    expect(commercial[0].amount).toBe(3000);
    expect(commercial[0].sourceFields).toEqual(expect.arrayContaining(["requestData.options", "requestData.commercialUse"]));
  });

  it("merges duplicate option IDs and applies quantity", () => {
    const result = createNatoriEstimateSuggestionV1({
      projectType: "standing",
      requestData: request({
        options: [
          { id: "expression_variation", label: "表情差分", quantity: 2, notes: "" },
          { id: "expression_variation", label: "名前変更後", quantity: 1, notes: "" },
        ],
      }),
      pricingConfig,
    });

    expect(result.automaticItems).toContainEqual(expect.objectContaining({
      presetItemId: "expression_variation",
      quantity: 3,
      unitAmount: 500,
      amount: 1500,
    }));
  });

  it("calculates percentage items from base price only", () => {
    const result = createNatoriEstimateSuggestionV1({
      projectType: "illustration",
      requestData: request({
        options: [
          { id: "expression_variation", label: "表情差分", quantity: 2, notes: "" },
          { id: "additional_character", label: "人物追加", quantity: 2, notes: "" },
        ],
      }),
      pricingConfig,
    });

    expect(result.automaticItems).toContainEqual(expect.objectContaining({
      presetItemId: "additional_character",
      quantity: 2,
      unitAmount: 8400,
      amount: 16800,
      baseAmount: 12000,
    }));
    expect(result.total).toBe(29800);
  });

  it("creates a blocker instead of substituting a missing base rule", () => {
    const config = { ...pricingConfig, items: pricingConfig.items.filter((item) => item.id !== "sd") };
    const result = createNatoriEstimateSuggestionV1({ projectType: "sd", requestData: request(), pricingConfig: config });

    expect(result.automaticItems.filter((item) => item.kind === "base")).toHaveLength(0);
    expect(result.reviewItems).toContainEqual(expect.objectContaining({ code: "pricing_base_rule_missing" }));
  });
});

describe("readNatoriPricingConfigV1", () => {
  it("accepts a valid versioned config and rejects legacy-shaped data", () => {
    expect(readNatoriPricingConfigV1(pricingConfig)).toEqual(pricingConfig);
    expect(readNatoriPricingConfigV1({ baseItems: [] })).toBeNull();
  });
});
