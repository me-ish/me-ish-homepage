import { describe, expect, it } from "vitest";
import { buildNatoriInquiryRequestView } from "@/features/natori/lib/inquiryRequestView";
import { describeNatoriUsageTypes } from "@/features/natori/lib/requestPresentation";
import { NATORI_USAGE_TYPES_V1, type NatoriRequestDataV1 } from "@/features/natori/types/request";

function request(overrides: Partial<NatoriRequestDataV1> = {}): NatoriRequestDataV1 {
  return {
    schemaVersion: 1, formVersion: "etorie-request-v1", inquiryMode: "consultation",
    requestType: "undecided", requestTypeOther: null, commissionScope: "undecided", commissionScopeOther: null,
    options: [], usageTypes: [], usageTypeOther: null, commercialUse: "unknown", publicationPolicy: "unknown",
    budget: { kind: "undecided", min: null, max: null, currency: "JPY" },
    deadline: { kind: "undecided", date: null, note: "" },
    characterFeatures: "", expressionMood: "", composition: "", colorDirection: "", referenceNotes: "",
    message: "題材と使用目的を区別した相談です。", legacySource: null, ...overrides,
  };
}
function structured(data: unknown) {
  const view = buildNatoriInquiryRequestView(data);
  expect(view.kind).toBe("structured");
  if (view.kind !== "structured") throw new Error("expected readable structured historical request");
  return view;
}
function usageFields(data: unknown) {
  const view = structured(data);
  const section = view.sections.find((item) => item.key === "usage");
  if (!section) throw new Error("usage section is missing");
  return { view, purpose: section.fields.find((field) => field.key === "usageTypes"), subject: section.fields.find((field) => field.key === "subjectTypes") };
}

describe("Phase 5 purpose and subject display semantics", () => {
  it("shows original_character as subject while leaving its persisted stable ID intact", () => {
    const data = request({ usageTypes: ["original_character"] });
    const raw = JSON.stringify(data);
    const { view, purpose, subject } = usageFields(data);
    expect(purpose).toEqual({ key: "usageTypes", label: "使用目的", value: "未定" });
    expect(subject).toEqual({ key: "subjectTypes", label: "題材", value: "オリジナルキャラクター" });
    expect(view.request.usageTypes).toEqual(["original_character"]);
    expect(JSON.stringify(data)).toBe(raw);
    expect(view.request).toStrictEqual(data);
  });

  it("keeps all eight purpose IDs in purpose and never infers subject from their wording", () => {
    const purposeIds = NATORI_USAGE_TYPES_V1.filter((id) => id !== "original_character");
    const data = request({ usageTypes: [...purposeIds], usageTypeOther: "オリジナルキャラクター展の会場掲示" });
    const { view, purpose, subject } = usageFields(data);
    expect(purpose?.label).toBe("使用目的");
    expect(purpose?.value).toBe(describeNatoriUsageTypes(data));
    expect(subject).toBeUndefined();
    expect(view.request.usageTypes).toEqual(purposeIds);
    expect(view.request.usageTypeOther).toBe(data.usageTypeOther);
  });

  it("separates mixed subject, commercial purposes and other notes without rewriting the original order", () => {
    const data = request({ usageTypes: ["advertising", "original_character", "social_icon", "other"], usageTypeOther: "展示会の案内", commercialUse: "yes" });
    const raw = JSON.stringify(data);
    const { view, purpose, subject } = usageFields(data);
    expect(purpose).toEqual({ key: "usageTypes", label: "使用目的", value: "広告・宣伝 / SNSアイコン / その他（展示会の案内）" });
    expect(subject).toEqual({ key: "subjectTypes", label: "題材", value: "オリジナルキャラクター" });
    expect(view.request.usageTypes).toEqual(data.usageTypes);
    expect(JSON.stringify(data)).toBe(raw);
    expect(view.request).toStrictEqual(data);
  });

  it("preserves historical legacy source and option label snapshots while presenting a subject separately", () => {
    const legacySource = { formVersion: "natori-portfolio-v1" as const, requestTypeLabel: "昔の依頼名", planLabel: "以前のプラン", optionLabels: ["旧表示の差分"], budgetLabel: "以前の予算表示", deadlineLabel: "以前の納期表示", referenceUrlsText: "https://example.com/history", details: "昔の説明", message: "保存された原文" };
    const data = request({ formVersion: "natori-portfolio-v1", usageTypes: ["original_character", "streaming"], options: [{ id: "historical_option", label: "旧表示の差分", quantity: 2, notes: "保存済み注記" }], legacySource });
    const raw = JSON.stringify(data);
    const { view, purpose, subject } = usageFields(data);
    expect(subject?.label).toBe("題材");
    expect(purpose?.value).toBe("配信で使用");
    expect(view.request.legacySource).toEqual(legacySource);
    expect(view.request.options).toEqual(data.options);
    expect(view.sections.flatMap((section) => section.fields).find((field) => field.key === "options")?.value).toBe("旧表示の差分 ×2（保存済み注記）");
    expect(JSON.stringify(data)).toBe(raw);
    expect(view.request).toStrictEqual(data);
  });

  it("displays unknown historical free-text labels literally under purpose without treating them as stable IDs", () => {
    const data = request({ usageTypes: ["other"], usageTypeOther: "original_character / 独自の旧ラベル" });
    const { view, purpose, subject } = usageFields(data);
    expect(purpose?.value).toBe("その他（original_character / 独自の旧ラベル）");
    expect(subject).toBeUndefined();
    expect(view.request.usageTypes).toEqual(["other"]);
  });

  it("continues to hand legacy note-only requests to the legacy reader", () => {
    expect(buildNatoriInquiryRequestView(null)).toEqual({ kind: "legacy" });
    expect(buildNatoriInquiryRequestView(undefined)).toEqual({ kind: "legacy" });
  });

  it("rejects unknown persisted usage IDs safely instead of guessing a subject or leaking raw data", () => {
    const data = { ...request(), usageTypes: ["future_private_subject"], usageTypeOther: "private historical content" };
    const raw = JSON.stringify(data);
    const view = buildNatoriInquiryRequestView(data);
    expect(view.kind).toBe("unsupported");
    if (view.kind !== "unsupported") throw new Error("unknown stable IDs must remain safely unsupported");
    expect(view.issue).toBe("request_data_invalid");
    expect(view.message).not.toContain("future_private_subject");
    expect(view.message).not.toContain("private historical content");
    expect(JSON.stringify(data)).toBe(raw);
  });
});
