import { describe, expect, it } from "vitest";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import {
  buildNatoriRequestDataV1, createInitialPortfolioRequestFormState, massProductionOptionChoices,
  portfolioOptionChoices, type PortfolioRequestFormState,
} from "@/features/natori/lib/portfolioRequestForm";
import { buildNatoriInquiryRequestView } from "@/features/natori/lib/inquiryRequestView";
import { validateNatoriRequestDataV1 } from "@/features/natori/lib/requestSchema";
import { portfolioConfirmationSections, readFrozenPortfolioSubmission, validatePortfolioForm } from "@/features/natori/lib/portfolioFormValidation";

const choices = portfolioOptionChoices(defaultPortfolioContent);
function state(patch: Partial<PortfolioRequestFormState> = {}): PortfolioRequestFormState {
  return { ...createInitialPortfolioRequestFormState(), message: "相談", ...patch };
}

describe("raw quantity validation before normalization", () => {
  it.each(["", " ", "abc", "2.5", "0", "11", -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects %s instead of saving one", (quantity) => {
    const input = state({ optionSelections: { expression_variation: { selected: true, quantity, notes: "" } } });
    expect(validatePortfolioForm(input, choices, "テスト", "client@example.com")).toEqual({
      success: false,
      errors: [{ path: "optionSelections.expression_variation.quantity", message: "数量は1〜10の整数で入力してください。" }],
    });
    expect(validateNatoriRequestDataV1(buildNatoriRequestDataV1(input, choices)).success).toBe(false);
  });
  it.each([1, 10, "1", "10"])("keeps valid quantity %s", (quantity) => {
    const input = state({ optionSelections: { expression_variation: { selected: true, quantity, notes: "笑顔" } } });
    const result = validatePortfolioForm(input, choices, "テスト", "client@example.com");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.requestData.options[0].quantity).toBe(Number(quantity));
  });
});

describe("canonical confirmation", () => {
  it.each(["consultation", "quote"] as const)("shows every answered condition from the actual %s submission", (inquiryMode) => {
    const input = state({
      inquiryMode, requestType: "other", requestTypeOther: "表紙", commissionScope: "other", commissionScopeOther: "二人の全身",
      optionSelections: { expression_variation: { selected: true, quantity: "2", notes: "笑顔・泣き顔" } },
      usageTypes: ["streaming", "other"], usageTypeOther: "特番", commercialUse: "yes", publicationPolicy: "delayed",
      publicationAllowedFrom: "2026-11-15", budgetKind: "range", budgetMin: "10000", budgetMax: "15000",
      deadlineKind: "preferred_date", deadlineDate: "2026-12-01", deadlineNote: "イベント前まで",
      characterFeatures: "水色の髪", expressionMood: "笑顔", composition: "二人並び", colorDirection: "青", referenceNotes: "画像の服装",
      referenceLinks: [{ url: " https://example.com/reference ", label: " 資料 " }],
    });
    const result = validatePortfolioForm(input, choices, " テスト ", " client@example.com ");
    expect(result.success).toBe(true);
    if (!result.success) return;
    const admin = buildNatoriInquiryRequestView(result.data.requestData);
    expect(admin.kind).toBe("structured");
    if (admin.kind !== "structured") return;
    const fields = portfolioConfirmationSections(result.data.requestData).flatMap((section) => section.fields);
    const adminFields = admin.sections.flatMap((section) => section.fields);
    expect(fields).toEqual(expect.arrayContaining(adminFields));
    expect(Object.fromEntries(fields.map((field) => [field.key, field.value]))).toMatchObject({
      requestType: "その他（表紙）", commissionScope: "その他（二人の全身）", options: "表情差分 ×2（笑顔・泣き顔）",
      usageTypes: "配信で使用 / その他（特番）", commercialUse: "商用利用する",
      publicationPolicy: "一定期間後なら公開してよい（2026年11月15日から）", budget: "10,000円〜15,000円",
      deadline: "2026年12月1日 希望 / イベント前まで", characterFeatures: "水色の髪", expressionMood: "笑顔",
      composition: "二人並び", colorDirection: "青", referenceNotes: "画像の服装", message: "相談",
    });
    expect(result.data.clientName).toBe("テスト");
    expect(result.data.clientEmail).toBe("client@example.com");
    expect(result.referenceLinks).toEqual([{ url: "https://example.com/reference", label: "資料" }]);
    expect(input.deadlineDate).toBe("2026-12-01");
  });
  it("keeps undecided consultation minimal and omits empty optional details", () => {
    const result = validatePortfolioForm(state(), choices, "テスト", "client@example.com");
    expect(result.success).toBe(true);
    if (!result.success) return;
    const fields = portfolioConfirmationSections(result.data.requestData).flatMap((section) => section.fields);
    expect(fields.find((field) => field.key === "message")?.value).toBe("相談");
    for (const key of ["characterFeatures", "expressionMood", "composition", "colorDirection", "referenceNotes", "options"]) {
      expect(fields.some((field) => field.key === key)).toBe(false);
    }
  });
  it("supports stopped mass-production fixtures without changing availability", () => {
    const result = validatePortfolioForm(state({
      requestType: "other", requestTypeOther: "量産イラスト", commissionScope: "other", commissionScopeOther: "魔女",
      expressionMood: "笑顔", commercialUse: "yes", optionSelections: { mass_expression_variation: { selected: true, quantity: 1, notes: "" } },
    }), massProductionOptionChoices(), "テスト", "client@example.com");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(portfolioConfirmationSections(result.data.requestData).flatMap((section) => section.fields)).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "commercialUse", value: "商用利用する" }), expect.objectContaining({ key: "requestType", value: "量産イラスト" }),
    ]));
  });
});

describe("frozen original confirmation", () => {
  it("reads original snapshots and answers after current content has changed", () => {
    const result = validatePortfolioForm(state({ optionSelections: {
      expression_variation: { selected: true, quantity: "2", notes: "笑顔・泣き顔" },
    }, referenceLinks: [{ url: "https://example.com/reference", label: "原資料" }] }), choices, "テスト", "client@example.com");
    if (!result.success) throw new Error("fixture invalid");
    const request = { ...result.data.requestData, options: [{ ...result.data.requestData.options[0], label: "以前の表情追加" }] };
    const fields = { name: "テスト", email: "client@example.com", requestData: JSON.stringify(request), referenceLinks: JSON.stringify(result.referenceLinks) };
    const encoded = JSON.stringify(fields);
    const restored = readFrozenPortfolioSubmission(fields);
    expect(restored.success).toBe(true);
    if (!restored.success) throw new Error("original frozen answers unavailable");
    expect(restored.data.requestData).toEqual(request);
    expect(portfolioConfirmationSections(restored.data.requestData).flatMap((section) => section.fields)).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "options", value: "以前の表情追加 ×2（笑顔・泣き顔）" }),
    ]));
    expect(restored.referenceLinks).toEqual(result.referenceLinks);
    expect(JSON.stringify(fields)).toBe(encoded);
  });
  it.each(["{invalid", "null", JSON.stringify([{ url: "http://example.com", label: "資料" }]), JSON.stringify([{ url: "https://example.com", label: 3 }])])("does not substitute current draft answers when frozen references are invalid: %s", (referenceLinks) => {
    const request = buildNatoriRequestDataV1(state(), choices);
    expect(readFrozenPortfolioSubmission({ name: "テスト", email: "client@example.com", requestData: JSON.stringify(request), referenceLinks }).success).toBe(false);
  });
});
