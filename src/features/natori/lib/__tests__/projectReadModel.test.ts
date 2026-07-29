import { describe, expect, it } from "vitest";
import {
  compareNatoriInquiriesByReceivedAt,
  formatNatoriProjectAmount,
  formatNatoriProjectDueDate,
  getNatoriNullableEditChanges,
  getNatoriInquiryReceivedISO,
  NATORI_PROJECT_TYPE_LABELS,
  toNatoriAmountInputValue,
  toNatoriDueDateInputValue,
} from "@/features/natori/lib/projectReadModel";
import type { NatoriProject } from "@/features/natori/types/projects";

function makeProject(overrides: Partial<NatoriProject> = {}): NatoriProject {
  return {
    id: overrides.id ?? "project-1",
    title: "相談",
    clientName: "依頼者",
    amount: null,
    dueDate: null,
    status: "inquiry",
    nextAction: "内容確認",
    type: "undecided",
    tasks: [],
    ...overrides,
  };
}

describe("nullable project display", () => {
  it("distinguishes an undecided amount from a free project", () => {
    expect(formatNatoriProjectAmount(null)).toBe("未定");
    expect(formatNatoriProjectAmount(0)).toBe("無料");
    expect(formatNatoriProjectAmount(12000)).toBe("￥12,000");
  });

  it("shows nullable due dates and undecided types without an implicit default", () => {
    expect(formatNatoriProjectDueDate(null, (value) => value)).toBe("未定");
    expect(formatNatoriProjectDueDate("2026-08-01", (value) => value)).toBe(
      "2026-08-01"
    );
    expect(NATORI_PROJECT_TYPE_LABELS.undecided).toBe("未定");
    expect(toNatoriAmountInputValue(null)).toBe("");
    expect(toNatoriDueDateInputValue(null)).toBe("");
  });

  it("omits unresolved fields so saving another edit does not overwrite them", () => {
    const project = makeProject();
    expect(
      getNatoriNullableEditChanges(project, {
        type: "undecided",
        amount: "",
        dueDate: "",
      })
    ).toEqual({});
    expect(
      getNatoriNullableEditChanges(project, {
        type: "icon",
        amount: "0",
        dueDate: "2026-08-01",
      })
    ).toEqual({ type: "icon", amount: 0, dueDate: "2026-08-01" });
  });
});

describe("inquiry received timestamp", () => {
  it("uses createdAt rather than dueDate", () => {
    const project = makeProject({
      createdAt: "2026-07-02T09:00:00.000Z",
      startDate: "2026-07-03",
      dueDate: "2026-07-01",
    });
    expect(getNatoriInquiryReceivedISO(project)).toBe("2026-07-02");
  });

  it("keeps a null-due inquiry in created-at ordering", () => {
    const older = makeProject({
      id: "older",
      createdAt: "2026-07-01T00:00:00.000Z",
      dueDate: null,
    });
    const newer = makeProject({
      id: "newer",
      createdAt: "2026-07-02T00:00:00.000Z",
      dueDate: "2026-06-01",
    });

    expect([newer, older].sort(compareNatoriInquiriesByReceivedAt).map((p) => p.id)).toEqual([
      "older",
      "newer",
    ]);
  });
});
