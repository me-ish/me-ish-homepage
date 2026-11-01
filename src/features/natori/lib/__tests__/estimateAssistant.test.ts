import { describe, expect, it } from "vitest";
import {
  ESTIMATE_ASSISTANT_MEMO_MARK,
  buildEstimateAssistantDraft,
  buildEstimateAssistantPrompt,
  isEstimateAssistantMemo,
  type EstimateAssistantOutput,
} from "@/features/natori/lib/estimateAssistant";
import { estimateDraftSchema } from "@/features/natori/lib/estimateDraft";
import type { NatoriPricingConfigV1 } from "@/features/natori/types/pricingSuggestion";
import type { NatoriRequestDataV1 } from "@/features/natori/types/request";

const pricingConfig: NatoriPricingConfigV1 = {
  schemaVersion: 1,
  currency: "JPY",
  items: [
    { id: "sd", kind: "base", label: "SD", amount: 3000 },
    { id: "bust_up", kind: "base", label: "胸上", amount: 4000 },
    { id: "full_body", kind: "base", label: "全身", amount: 10000 },
    { id: "expression_variation", kind: "fixed", label: "表情差分", amount: 500 },
    { id: "commercial_use", kind: "fixed", label: "商用利用", amount: 3000 },
  ],
};

const requestData = {
  schemaVersion: 1, formVersion: "etorie-request-v1", inquiryMode: "quote",
  requestType: "illustration", requestTypeOther: null, commissionScope: "undecided", commissionScopeOther: null,
  options: [], usageTypes: ["streaming"], usageTypeOther: null, commercialUse: "unknown",
  publicationPolicy: "unknown", publicationAllowedFrom: null,
  budget: { kind: "undecided", min: null, max: null, currency: "JPY" },
  deadline: { kind: "standard", date: null, note: "" },
  characterFeatures: "銀髪の狐", expressionMood: "", composition: "", colorDirection: "",
  referenceNotes: "", message: "配信の立ち絵として全身でお願いしたいです。表情差分を2つほしいです。", legacySource: null,
} as NatoriRequestDataV1;

const project = { type: "standing" as const, deliveryPlan: "normal" as const, dueDate: null, requestData };

function output(overrides: Partial<EstimateAssistantOutput> = {}): EstimateAssistantOutput {
  return {
    summary: "配信用の立ち絵（全身）。表情差分2つ。",
    scope: "full_body", scopeNote: "", deliverables: "配信用立ち絵（全身）1点、表情差分2点",
    usage: "配信", commercialUse: "unknown", publication: "", dueDate: "",
    options: [{ id: "expression_variation", quantity: 2, reason: "表情差分を2つ希望" }],
    questions: ["収益化した配信で使う予定はありますか？"],
    ...overrides,
  };
}

describe("buildEstimateAssistantDraft", () => {
  it("金額は料金表から計算し、メモに要点と確認事項を残す", () => {
    const draft = buildEstimateAssistantDraft({ project, requestData, output: output(), pricingConfig, createdAt: "10/30 18:00" });
    expect(draft.items.map((item) => [item.labelSnapshot, item.quantity, item.amount])).toEqual([
      ["全身", 1, 10000],
      ["表情差分", 2, 1000],
    ]);
    expect(isEstimateAssistantMemo(draft.agreedTerms.memo)).toBe(true);
    expect(draft.agreedTerms.memo).toContain("・収益化した配信で使う予定はありますか？");
    expect(estimateDraftSchema.safeParse(draft).success).toBe(true);
  });

  it("料金表にないオプションは入れず、商用利用ありなら商用利用を足す", () => {
    const draft = buildEstimateAssistantDraft({
      project, requestData, pricingConfig, createdAt: "10/30 18:00",
      output: output({ commercialUse: "yes", options: [{ id: "made_up", quantity: 1, reason: "" }, { id: "expression_variation", quantity: 99, reason: "" }] }),
    });
    expect(draft.items.map((item) => [item.presetItemId, item.quantity])).toEqual([
      ["full_body", 1], ["expression_variation", 10], ["commercial_use", 1],
    ]);
  });

  it("範囲が決まっていないときや種別が未確定のときは明細を作らない", () => {
    expect(buildEstimateAssistantDraft({ project, requestData, pricingConfig, createdAt: "", output: output({ scope: "undecided" }) }).items).toEqual([]);
    expect(buildEstimateAssistantDraft({ project: { ...project, type: "undecided" }, requestData, pricingConfig, createdAt: "", output: output() }).items).toEqual([]);
  });

  it("おかしな日付は使わず、長すぎる文章は保存できる長さに切る", () => {
    const draft = buildEstimateAssistantDraft({
      project, requestData, pricingConfig, createdAt: "",
      output: output({ dueDate: "2026-02-30", summary: "あ".repeat(5000), questions: Array.from({ length: 9 }, (_, index) => `質問${index}${"い".repeat(400)}`) }),
    });
    expect(draft.agreedTerms.dueDate).toBe("");
    expect(draft.agreedTerms.memo.startsWith(ESTIMATE_ASSISTANT_MEMO_MARK)).toBe(true);
    expect(estimateDraftSchema.safeParse(draft).success).toBe(true);
  });
});

describe("buildEstimateAssistantPrompt", () => {
  it("料金表のオプションと依頼内容・トークを含め、基本料金の行は渡さない", () => {
    const prompt = buildEstimateAssistantPrompt({
      requestData, projectType: "standing", dueDate: null, pricingConfig, today: "2026-10-30",
      messages: [{ sender: "client", body: "背景はなしで大丈夫です" }],
    });
    expect(prompt).toContain("id: expression_variation / 表情差分");
    expect(prompt).not.toContain("id: full_body");
    expect(prompt).toContain("銀髪の狐");
    expect(prompt).toContain("[依頼者] 背景はなしで大丈夫です");
    expect(prompt).not.toContain("2026-10-30T09");
  });
});
