import { describe, expect, it } from "vitest";
import { createNatoriEstimateSuggestionV1, readNatoriPricingConfigV1 } from "@/features/natori/lib/pricingSuggestion";
import type { NatoriRequestDataV1 } from "@/features/natori/types/request";
import type { NatoriPricingConfigV1 } from "@/features/natori/types/pricingSuggestion";

const pricingConfig: NatoriPricingConfigV1 = {
  schemaVersion: 1,
  currency: "JPY",
  items: [
    { id: "sd", kind: "base", label: "SD", amount: 3000 },
    { id: "bust_up", kind: "base", label: "胸上", amount: 4000 },
    { id: "waist_up", kind: "base", label: "膝〜腰上", amount: 6000 },
    { id: "full_body", kind: "base", label: "全身", amount: 10000 },
    { id: "mass_production_illustration", kind: "base", label: "量産イラスト", amount: 1500 },
    { id: "expression_variation", kind: "fixed", label: "表情差分", amount: 500 },
    { id: "detailed_background", kind: "fixed", label: "しっかり背景", amount: 3000, note: "公開料金 +3,000円〜5,000円" },
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
    publicationAllowedFrom: null,
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
  it("量産の基本1500円と専用オプション500/500、商用1000円を見積もる", () => {
    const result = createNatoriEstimateSuggestionV1({
      projectType: "undecided",
      pricingConfig,
      requestData: request({
        requestType: "other",
        requestTypeOther: "量産イラスト",
        commissionScope: "other",
        commissionScopeOther: "おばけ",
        expressionMood: "笑顔",
        commercialUse: "yes",
        options: [
          { id: "mass_costume_color_change", label: "衣装カラーチェンジ", quantity: 1, notes: "" },
          { id: "mass_expression_variation", label: "表情差分", quantity: 1, notes: "" },
        ],
      }),
    });

    expect(result.automaticItems.map((item) => [item.presetItemId, item.amount])).toEqual([
      ["mass_production_illustration", 1500],
      ["mass_costume_color_change", 500],
      ["mass_expression_variation", 500],
      ["commercial_use", 1000],
    ]);
    expect(result.total).toBe(3500);
    expect(result.canIssueQuote).toBe(false); // 案件種別の管理確定は引き続き必要。
  });

  it("通常依頼は project type ではなく制作範囲を基本料金に使う", () => {
    const result = createNatoriEstimateSuggestionV1({
      projectType: "icon",
      requestData: request({ commissionScope: "full_body" }),
      pricingConfig,
    });

    expect(result.automaticItems[0]).toMatchObject({
      presetItemId: "full_body",
      amount: 10000,
      sourceField: "requestData.commissionScope",
      ruleId: "base:full_body",
    });
  });

  it("案件種別が未確定でも料金候補は制作範囲から出すが正式発行は止める", () => {
    const result = createNatoriEstimateSuggestionV1({
      projectType: "undecided",
      requestData: request(),
      pricingConfig,
    });

    expect(result.automaticItems).toContainEqual(expect.objectContaining({
      presetItemId: "full_body",
      amount: 10000,
    }));
    expect(result.reviewItems).toContainEqual(expect.objectContaining({
      code: "project_type_unconfirmed",
      severity: "blocker",
    }));
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
    expect(commercial[0].sourceFields).toEqual(expect.arrayContaining([
      "requestData.options",
      "requestData.commercialUse",
    ]));
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

  it("人物追加は制作範囲の基本料金だけを基準に70%計算する", () => {
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
      unitAmount: 7000,
      amount: 14000,
      baseAmount: 10000,
    }));
    expect(result.total).toBe(25000);
  });

  it("SDは制作範囲ではなくSD基本料金を使う", () => {
    const result = createNatoriEstimateSuggestionV1({
      projectType: "sd",
      requestData: request({ requestType: "sd", commissionScope: "full_body" }),
      pricingConfig,
    });

    expect(result.automaticItems[0]).toMatchObject({
      presetItemId: "sd",
      amount: 3000,
      sourceField: "requestData.requestType",
    });
  });

  it("creates a blocker instead of substituting a missing SD base rule", () => {
    const config = {
      ...pricingConfig,
      items: pricingConfig.items.filter((item) => item.id !== "sd"),
    };
    const result = createNatoriEstimateSuggestionV1({
      projectType: "sd",
      requestData: request({ requestType: "sd" }),
      pricingConfig: config,
    });

    expect(result.automaticItems.filter((item) => item.kind === "base")).toHaveLength(0);
    expect(result.reviewItems).toContainEqual(expect.objectContaining({
      code: "pricing_base_rule_missing",
    }));
  });

  it("しっかり背景は下限額を候補にしつつ最終確認を要求する", () => {
    const result = createNatoriEstimateSuggestionV1({
      projectType: "illustration",
      requestData: request({
        options: [{ id: "detailed_background", label: "しっかり背景", quantity: 1, notes: "" }],
      }),
      pricingConfig,
    });

    expect(result.automaticItems).toContainEqual(expect.objectContaining({
      presetItemId: "detailed_background",
      amount: 3000,
    }));
    expect(result.reviewItems).toContainEqual(expect.objectContaining({
      code: "detailed_background_requires_review",
      severity: "attention",
    }));
  });

  it("お急ぎ料金を加算しつつ対応可否確認を要求する", () => {
    const result = createNatoriEstimateSuggestionV1({
      projectType: "illustration",
      requestData: request({
        deadline: { kind: "rush_consultation", date: null, note: "" },
      }),
      pricingConfig,
    });

    expect(result.automaticItems).toContainEqual(expect.objectContaining({
      presetItemId: "rush_delivery",
      amount: 2000,
    }));
    expect(result.reviewItems).toContainEqual(expect.objectContaining({
      code: "rush_availability_requires_review",
      severity: "attention",
    }));
  });
});

describe("readNatoriPricingConfigV1", () => {
  it("accepts a valid versioned config and rejects legacy-shaped data", () => {
    expect(readNatoriPricingConfigV1(pricingConfig)).toEqual(pricingConfig);
    expect(readNatoriPricingConfigV1({ baseItems: [] })).toBeNull();
  });
});
