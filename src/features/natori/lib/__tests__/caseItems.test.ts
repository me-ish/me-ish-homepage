import { describe, expect, it } from "vitest";
import {
  caseItemFields,
  caseItemPublicationOpen,
  caseItemsEarliestDue,
  caseItemsToEstimateLines,
  caseItemsTotal,
  nextCaseItemPosition,
} from "../caseItems";
import { estimateDraftItemSchema } from "../estimateDraft";

const base = {
  title: "クリスマス等身",
  projectType: "standing" as const,
  amount: 12000,
  dueDate: "2026-12-20",
  progress: "not_started" as const,
  publicationPolicy: "delayed" as const,
  publicationAllowedFrom: "2026-12-26",
  note: null,
};

describe("caseItemFields", () => {
  it("accepts a full item and trims the title", () => {
    expect(caseItemFields.parse({ ...base, title: "  SD  " }).title).toBe("SD");
  });
  it("needs a date exactly when the policy is delayed", () => {
    expect(caseItemFields.safeParse({ ...base, publicationAllowedFrom: null }).success).toBe(false);
    expect(caseItemFields.safeParse({ ...base, publicationPolicy: "allowed" }).success).toBe(false);
    expect(caseItemFields.safeParse({ ...base, publicationPolicy: "allowed", publicationAllowedFrom: null }).success).toBe(true);
  });
  it("rejects impossible dates, blank titles, negative amounts and unknown fields", () => {
    expect(caseItemFields.safeParse({ ...base, dueDate: "2026-02-30" }).success).toBe(false);
    expect(caseItemFields.safeParse({ ...base, title: "   " }).success).toBe(false);
    expect(caseItemFields.safeParse({ ...base, amount: -1 }).success).toBe(false);
    expect(caseItemFields.safeParse({ ...base, position: 1 }).success).toBe(false);
  });
});

describe("item helpers", () => {
  it("adds after the last position and stops at 20", () => {
    expect(nextCaseItemPosition([])).toBe(1);
    expect(nextCaseItemPosition([{ position: 1 }, { position: 3 }])).toBe(4);
    expect(nextCaseItemPosition([{ position: 20 }])).toBeNull();
  });
  it("totals only when every item has an amount", () => {
    expect(caseItemsTotal([{ amount: 12000 }, { amount: 5000 }])).toBe(17000);
    expect(caseItemsTotal([{ amount: 12000 }, { amount: null }])).toBeNull();
    expect(caseItemsTotal([])).toBeNull();
  });
  it("finds the earliest due date", () => {
    expect(caseItemsEarliestDue([{ dueDate: "2026-12-30" }, { dueDate: null }, { dueDate: "2026-12-20" }])).toBe("2026-12-20");
    expect(caseItemsEarliestDue([{ dueDate: null }])).toBeNull();
  });
  it("opens publication only when allowed or once the date has come", () => {
    expect(caseItemPublicationOpen({ publicationPolicy: "allowed", publicationAllowedFrom: null }, "2026-11-05")).toBe(true);
    expect(caseItemPublicationOpen({ publicationPolicy: "delayed", publicationAllowedFrom: "2026-12-26" }, "2026-12-25")).toBe(false);
    expect(caseItemPublicationOpen({ publicationPolicy: "delayed", publicationAllowedFrom: "2026-12-26" }, "2026-12-26")).toBe(true);
    for (const policy of ["work_private", "fully_private", "unknown"] as const)
      expect(caseItemPublicationOpen({ publicationPolicy: policy, publicationAllowedFrom: null }, "2030-01-01")).toBe(false);
  });
});

describe("caseItemsToEstimateLines", () => {
  const base = { projectId: "p", projectType: null, dueDate: null, progress: "not_started" as const, publicationPolicy: "unknown" as const, publicationAllowedFrom: null, note: null, updatedAt: "t" };
  it("makes one line per item in position order", () => {
    let n = 0;
    const lines = caseItemsToEstimateLines([
      { ...base, id: "b", position: 2, title: "正月等身", amount: 15000 },
      { ...base, id: "a", position: 1, title: "クリスマス等身", amount: 12000 },
    ], () => `id${++n}`);
    expect(lines?.map((l) => [l.labelSnapshot, l.quantity, l.unitAmount, l.amount, l.kind])).toEqual([
      ["クリスマス等身", 1, 12000, 12000, "manual"],
      ["正月等身", 1, 15000, 15000, "manual"],
    ]);
    expect(lines?.every((l) => estimateDraftItemSchema.safeParse(l).success)).toBe(true);
  });
  it("waits until every item has an amount", () => {
    expect(caseItemsToEstimateLines([{ ...base, id: "a", position: 1, title: "SD", amount: null }], () => "x")).toBeNull();
    expect(caseItemsToEstimateLines([], () => "x")).toBeNull();
  });
});
