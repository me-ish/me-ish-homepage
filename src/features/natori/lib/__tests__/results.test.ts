import { describe, expect, it } from "vitest";
import {
  filterProjectsByMonth,
  filterProjectsByYear,
  isNatoriCompletedProject,
  listNatoriResultYears,
  summarizeNatoriResults,
} from "@/features/natori/lib/results";
import type { NatoriProject } from "@/features/natori/types/projects";

function makeProject(overrides: Partial<NatoriProject>): NatoriProject {
  return {
    id: "p1",
    title: "テスト案件",
    clientName: "テスト依頼者",
    amount: 10000,
    dueDate: "2026-05-10",
    status: "completed",
    nextAction: "",
    type: "icon",
    tasks: [],
    ...overrides,
  };
}

describe("isNatoriCompletedProject", () => {
  it("counts delivered and completed as results", () => {
    expect(isNatoriCompletedProject(makeProject({ status: "delivered" }))).toBe(true);
    expect(isNatoriCompletedProject(makeProject({ status: "completed" }))).toBe(true);
    expect(isNatoriCompletedProject(makeProject({ status: "rough" }))).toBe(false);
    expect(isNatoriCompletedProject(makeProject({ status: "inquiry" }))).toBe(false);
  });
});

describe("summarizeNatoriResults", () => {
  const now = new Date(2026, 6, 11); // 2026-07-11

  it("returns zeros for no completed projects", () => {
    const summary = summarizeNatoriResults(
      [makeProject({ status: "rough" })],
      now
    );
    expect(summary.totalCount).toBe(0);
    expect(summary.totalAmount).toBe(0);
    expect(summary.averageAmount).toBe(0);
    expect(summary.monthly).toEqual([]);
    expect(summary.byType).toEqual([]);
    expect(summary.completed).toEqual([]);
  });

  it("aggregates totals, this year, monthly and type breakdowns", () => {
    const summary = summarizeNatoriResults(
      [
        makeProject({ id: "a", amount: 10000, dueDate: "2026-05-10", type: "icon" }),
        makeProject({ id: "b", amount: 30000, dueDate: "2026-05-20", type: "standing", status: "delivered" }),
        makeProject({ id: "c", amount: 20000, dueDate: "2025-12-01", type: "icon" }),
        // 進行中は集計に入らない
        makeProject({ id: "d", amount: 99999, dueDate: "2026-06-01", status: "coloring" }),
      ],
      now
    );

    expect(summary.totalCount).toBe(3);
    expect(summary.totalAmount).toBe(60000);
    expect(summary.averageAmount).toBe(20000);
    expect(summary.thisYearCount).toBe(2);
    expect(summary.thisYearAmount).toBe(40000);

    // 新しい月が先頭
    expect(summary.monthly.map((m) => m.ym)).toEqual(["2026-05", "2025-12"]);
    expect(summary.monthly[0]).toMatchObject({
      label: "2026年5月",
      count: 2,
      amount: 40000,
    });

    // 金額の大きい順
    expect(summary.byType.map((t) => t.type)).toEqual(["standing", "icon"]);
    expect(summary.byType[1]).toMatchObject({ count: 2, amount: 30000 });

    // 納期の新しい順
    expect(summary.completed.map((p) => p.id)).toEqual(["b", "a", "c"]);
  });
});

describe("listNatoriResultYears / filterProjectsByYear", () => {
  const projects = [
    makeProject({ id: "a", dueDate: "2026-05-10" }),
    makeProject({ id: "b", dueDate: "2025-12-01", status: "delivered" }),
    makeProject({ id: "c", dueDate: "2024-01-01", status: "rough" }), // 未完了は年に数えない
  ];

  it("lists years of completed projects, newest first", () => {
    expect(listNatoriResultYears(projects)).toEqual([2026, 2025]);
  });

  it("filters by year and passes through on null", () => {
    expect(filterProjectsByYear(projects, 2025).map((p) => p.id)).toEqual(["b"]);
    expect(filterProjectsByYear(projects, null)).toHaveLength(3);
  });

  it("filters by month and passes through on null", () => {
    expect(filterProjectsByMonth(projects, "2026-05").map((p) => p.id)).toEqual(["a"]);
    expect(filterProjectsByMonth(projects, "2025-12").map((p) => p.id)).toEqual(["b"]);
    expect(filterProjectsByMonth(projects, null)).toHaveLength(3);
  });
});
