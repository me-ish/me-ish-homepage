// PREPARED ONLY: apply to src/features/natori/lib/__tests__ after Phase 5 helpers land.
// Not executed; projections return errors only and must never become the submitted request.
import { describe, expect, it } from "vitest";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import {
  buildNatoriRequestDataV1, buildSelectedOptions, createInitialPortfolioRequestFormState,
  massProductionOptionChoices, portfolioOptionChoices,
  type PortfolioOptionChoice, type PortfolioRequestFormState,
} from "@/features/natori/lib/portfolioRequestForm";
import {
  validatePortfolioForm, validatePortfolioStep,
} from "@/features/natori/lib/portfolioFormValidation";
import { portfolioErrorTarget } from "@/features/natori/lib/portfolioFormFeedback";
import {
  describeNatoriDeadline, describeNatoriPublicationPolicy,
} from "@/features/natori/lib/requestPresentation";

const choices = portfolioOptionChoices(defaultPortfolioContent);
const legacyChoices: PortfolioOptionChoice[] = [
  { key: "legacy-option-0", stableId: null, label: "旧オプションA", price: "+100円" },
  { key: "legacy-option-1", stableId: null, label: "旧オプションB", price: "+200円" },
];
function state(patch: Partial<PortfolioRequestFormState> = {}): PortfolioRequestFormState {
  return { ...createInitialPortfolioRequestFormState(), message: "相談", ...patch };
}
const errorPaths = (input: PortfolioRequestFormState, step: number, name = "", email = "") =>
  validatePortfolioStep(input, choices, name, email, step).map((error) => error.path);

describe("Phase 5 current-step validation", () => {
  it("does not let a later invalid numeric type conceal current Other requirements", () => {
    const input = state({ inquiryMode: "quote", requestType: "other", requestTypeOther: "", budgetKind: "fixed", budgetMin: "bad" });
    const paths = errorPaths(input, 0);
    expect(paths).toContain("requestData.requestTypeOther");
    expect(paths).not.toContain("requestData.budget.min");
    expect(paths).not.toContain("clientName");
    expect(paths).not.toContain("clientEmail");
    expect(input.budgetMin).toBe("bad");
  });

  it("allows undecided production without adding requirements from the next step", () => {
    const input = state({ inquiryMode: "quote", message: "", publicationPolicy: "delayed", publicationAllowedFrom: "", budgetKind: "fixed", budgetMin: "bad" });
    expect(errorPaths(input, 0)).toEqual([]);
    expect(validatePortfolioForm(input, choices, "", "").success).toBe(false);
  });

  it("rejects current reference URLs and raw quantities before advancing", () => {
    const input = state({ inquiryMode: "quote", optionSelections: { expression_variation: { selected: true, quantity: "2.5", notes: "" } } });
    expect(errorPaths(input, 0)).toContain("optionSelections.expression_variation.quantity");
    input.optionSelections.expression_variation.quantity = "2";
    input.referenceLinks = [{ url: "ftp://invalid.example", label: "資料" }];
    expect(errorPaths(input, 0)).toContain("referenceLinks.0.url");
  });

  it("retains current mass-production conditional requirements in the step projection", () => {
    const input = state({ inquiryMode: "quote", requestType: "other", requestTypeOther: "量産イラスト", commissionScope: "other", commissionScopeOther: "", expressionMood: "", budgetKind: "fixed", budgetMin: "bad" });
    const paths = validatePortfolioStep(input, massProductionOptionChoices(), "", "", 0).map((error) => error.path);
    expect(paths).toContain("requestData.commissionScopeOther");
    expect(paths).toContain("requestData.expressionMood");
    expect(paths).not.toContain("requestData.budget.min");
  });

  it("validates contact and current conditions independently of invalid earlier production", () => {
    const input = state({ inquiryMode: "quote", requestType: "other", requestTypeOther: "", usageTypes: ["other"], usageTypeOther: "", publicationPolicy: "delayed", publicationAllowedFrom: "", referenceLinks: [{ url: "ftp://invalid.example", label: "" }] });
    const paths = errorPaths(input, 1);
    expect(paths).toEqual(expect.arrayContaining(["clientName", "clientEmail", "requestData.usageTypeOther", "requestData.publicationAllowedFrom"]));
    expect(paths).not.toContain("requestData.requestTypeOther");
    expect(paths).not.toContain("referenceLinks.0.url");
  });

  it("never treats a valid conditions projection as a valid complete request", () => {
    const input = state({ inquiryMode: "quote", optionSelections: { expression_variation: { selected: true, quantity: "2.5", notes: "" } }, referenceLinks: [{ url: "ftp://invalid.example", label: "" }] });
    expect(errorPaths(input, 1, "テスト", "client@example.com")).toEqual([]);
    expect(validatePortfolioForm(input, choices, "テスト", "client@example.com").success).toBe(false);
  });

  it("keeps consultation minimal while validating answered conditional fields on its only input step", () => {
    expect(errorPaths(state(), 0, "テスト", "client@example.com")).toEqual([]);
    expect(errorPaths(state({ publicationPolicy: "delayed", publicationAllowedFrom: "" }), 0, "テスト", "client@example.com"))
      .toContain("requestData.publicationAllowedFrom");
    expect(errorPaths(state({ message: "", characterFeatures: "水色の髪" }), 0, "テスト", "client@example.com")).toEqual([]);
  });
});

describe("Phase 5 lossless legacy option answers", () => {
  it("preserves quantity-one/no-note compatibility without inventing stable IDs", () => {
    const input = state({ optionSelections: {
      "legacy-option-0": { selected: true, quantity: 1, notes: "" },
      "legacy-option-1": { selected: true, quantity: 1, notes: "" },
    } });
    expect(buildSelectedOptions(input, legacyChoices)).toEqual([
      { id: "other", label: "その他のオプション", quantity: 1, notes: "旧オプションA / 旧オプションB" },
    ]);
  });

  it("retains the requested count and notes inside the existing Other representation", () => {
    const input = state({ optionSelections: { "legacy-option-0": { selected: true, quantity: "2", notes: " 青・緑 " } } });
    expect(buildSelectedOptions(input, legacyChoices)).toEqual([
      { id: "other", label: "その他のオプション", quantity: 1, notes: "旧オプションA ×2（青・緑）" },
    ]);
    expect(validatePortfolioForm(input, legacyChoices, "テスト", "client@example.com").success).toBe(true);
  });

  it("rejects fractional legacy counts before aggregation could hide the invalid input", () => {
    const input = state({ optionSelections: { "legacy-option-0": { selected: true, quantity: "2.5", notes: "" } } });
    const result = validatePortfolioForm(input, legacyChoices, "テスト", "client@example.com");
    expect(result.success).toBe(false);
    if (result.success) throw new Error("fractional legacy count was accepted");
    expect(result.errors.map((error) => error.path)).toContain("optionSelections.legacy-option-0.quantity");
    expect(portfolioErrorTarget(result.errors[0].path, input, legacyChoices)).toEqual({ id: "pf-option-legacy-option-0-quantity", section: "requestType" });
  });

  it("reports over-limit notes instead of silently truncating the answer", () => {
    const notes = "あ".repeat(301);
    const input = state({ optionSelections: { expression_variation: { selected: true, quantity: 1, notes } } });
    expect(buildSelectedOptions(input, choices)[0].notes).toBe(notes);
    const result = validatePortfolioForm(input, choices, "テスト", "client@example.com");
    expect(result.success).toBe(false);
    if (result.success) throw new Error("over-limit notes were accepted");
    expect(result.errors.map((error) => error.path)).toContain("requestData.options.0.notes");
  });

  it("rejects a combined legacy summary that exceeds the V1 Other notes field", () => {
    const notes = "あ".repeat(160);
    const input = state({ optionSelections: {
      "legacy-option-0": { selected: true, quantity: "2", notes },
      "legacy-option-1": { selected: true, quantity: "2", notes },
    } });
    expect(buildSelectedOptions(input, legacyChoices)[0].notes.length).toBeGreaterThan(300);
    expect(validatePortfolioForm(input, legacyChoices, "テスト", "client@example.com").success).toBe(false);
  });
});

describe("Phase 5 date-only display contract", () => {
  it.each([
    ["2026-01-01", "2026年1月1日"],
    ["2028-02-29", "2028年2月29日"],
    ["2026-12-31", "2026年12月31日"],
  ])("renders %s without changing the stored desired or publication date", (date, display) => {
    const input = state({ publicationPolicy: "delayed", publicationAllowedFrom: date, deadlineKind: "preferred_date", deadlineDate: date, deadlineNote: "希望であり確定日ではありません" });
    const request = buildNatoriRequestDataV1(input, choices);
    expect(describeNatoriDeadline(request.deadline)).toBe(`${display} 希望 / 希望であり確定日ではありません`);
    expect(describeNatoriPublicationPolicy(request)).toBe(`一定期間後なら公開してよい（${display}から）`);
    expect(request.deadline.date).toBe(date);
    expect(request.publicationAllowedFrom).toBe(date);
    expect(input.deadlineDate).toBe(date);
  });
});
