import { describe, expect, it } from "vitest";
import { defaultEstimateTerms, estimateDraftSchema, estimateTotal, validateEstimateTermsForIssue } from "@/features/natori/lib/estimateDraft";
import type { NatoriProject } from "@/features/natori/types/projects";

const project: NatoriProject = {
  id: "sample", clientName: "依頼者", title: "一枚絵", type: "undecided", status: "inquiry",
  amount: null, dueDate: null, nextAction: "相談", tasks: [],
};

describe("estimate draft", () => {
  it("starts without guessing the agreed deliverables or date", () => {
    const defaults = defaultEstimateTerms(project);
    expect(defaults.deliverables).toBe("");
    expect(defaults.dueDate).toBe("");
    expect(defaults.scope).toBe("undecided");
    expect(defaults.commercialUse).toBe("unknown");
  });

  it("keeps an undecided consultation from being issued", () => {
    expect(validateEstimateTermsForIssue(defaultEstimateTerms(project))).toContain("制作するもの");
    expect(validateEstimateTermsForIssue(defaultEstimateTerms(project))).toContain("納品日");
    expect(validateEstimateTermsForIssue({ ...defaultEstimateTerms(project), dueDate: "2026-02-30" })).toContain("納品日");
  });

  it("rejects a line whose amount does not match quantity and unit amount", () => {
    const data = estimateDraftSchema.safeParse({ agreedTerms: defaultEstimateTerms(project), items: [{
      id: "line", presetItemId: null, kind: "manual", labelSnapshot: "一枚絵", quantity: 2,
      unitAmount: 500, amount: 500, automatic: false, sourceFields: [], ruleId: null, note: null,
    }] });
    expect(data.success).toBe(false);
    expect(estimateTotal([{ id: "line", presetItemId: null, kind: "manual", labelSnapshot: "一枚絵", quantity: 2, unitAmount: 500, amount: 1000, automatic: false, sourceFields: [], ruleId: null, note: null }])).toBe(1000);
  });
});
