import { describe, expect, it } from "vitest";
import {
  applyStatusToTasks,
  createTasksForType,
  toISODate,
} from "@/lib/natori/projects";
import {
  computeProjectScheduling,
  formatHours,
  getAwaitingPaymentSummary,
  getProjectRemainingHours,
  getProjectTotalHours,
  getScheduleEntries,
  getWeeklyForecast,
} from "@/lib/natori/scheduling";
import { calculateDueDate, getDeliveryPlanMeta } from "@/lib/natori/deliveryPlans";
import type {
  NatoriDeliveryPlan,
  NatoriProject,
  NatoriProjectStatus,
  NatoriProjectType,
} from "@/types/natori/projects";

const TODAY = new Date(2026, 4, 22);

function buildProject(overrides: Partial<NatoriProject> = {}): NatoriProject {
  const type: NatoriProjectType = overrides.type ?? "illustration";
  const status: NatoriProjectStatus = overrides.status ?? "rough";
  const tasks = overrides.tasks ?? applyStatusToTasks(createTasksForType(type), status);
  return {
    id: overrides.id ?? "p-1",
    title: overrides.title ?? "テスト案件",
    clientName: overrides.clientName ?? "テストさん",
    amount: overrides.amount ?? 10000,
    dueDate: overrides.dueDate ?? "2026-06-21",
    status,
    nextAction: overrides.nextAction ?? "次の作業",
    type,
    tasks,
    priority: overrides.priority,
    note: overrides.note,
    deliveryPlan: overrides.deliveryPlan,
    startDate: overrides.startDate,
  };
}

describe("calculateDueDate", () => {
  it("uses each plan's day offset from the start date", () => {
    const start = "2026-05-01";
    expect(calculateDueDate(start, "normal")).toBe("2026-05-31");
    expect(calculateDueDate(start, "rush_14_days")).toBe("2026-05-15");
    expect(calculateDueDate(start, "rush_7_days")).toBe("2026-05-08");
  });
});

describe("getProjectTotalHours / getProjectRemainingHours", () => {
  it("sums estimated hours from task templates", () => {
    const project = buildProject({ type: "icon" });
    expect(getProjectTotalHours(project)).toBe(4);
    expect(getProjectRemainingHours(project)).toBe(4);
  });

  it("excludes completed tasks from remaining hours", () => {
    const project = buildProject({ type: "icon" });
    project.tasks[0].done = true; // ラフ 1h
    project.tasks[1].done = true; // 清書 1h
    expect(getProjectRemainingHours(project)).toBe(1.5 + 0.5);
  });

  it("falls back to stage defaults when estimatedHours is missing", () => {
    const project = buildProject({
      tasks: [
        { id: "x", label: "no estimate", stage: "rough", done: false },
      ],
    });
    expect(getProjectTotalHours(project)).toBe(3); // DEFAULT_STAGE_HOURS.rough
  });
});

describe("computeProjectScheduling", () => {
  it("spreads remaining hours across the days until due", () => {
    const project = buildProject({
      type: "illustration",
      status: "rough",
      dueDate: "2026-06-21", // 30 days from TODAY
      tasks: createTasksForType("illustration"), // 1+3+5+7+1.5+0.5 = 18h
    });
    const s = computeProjectScheduling(project, TODAY);
    expect(s.totalHours).toBe(18);
    expect(s.remainingHours).toBe(18);
    expect(s.daysUntilDue).toBe(30);
    expect(s.workableDaysUntilDue).toBe(30);
    expect(s.requiredPerDay).toBeCloseTo(0.6, 5);
    expect(s.requiredThisWeek).toBeCloseTo(4.2, 5);
    expect(s.isBlocked).toBe(false);
    expect(s.isOverdue).toBe(false);
    expect(s.isRush).toBe(false);
  });

  it("flags rush plans and produces a higher daily target", () => {
    const project = buildProject({
      type: "illustration",
      status: "rough",
      dueDate: toISODate(new Date(2026, 4, 22 + 7)),
      deliveryPlan: "rush_7_days",
      tasks: createTasksForType("illustration"), // 18h, none auto-completed
    });
    const s = computeProjectScheduling(project, TODAY);
    expect(s.isRush).toBe(true);
    expect(s.daysUntilDue).toBe(7);
    expect(s.requiredPerDay).toBeCloseTo(18 / 7, 5);
  });

  it("treats consulting / awaiting_payment / waiting as 0h pressure", () => {
    for (const status of ["consulting", "quoted", "awaiting_payment", "waiting"] as const) {
      const project = buildProject({ status, dueDate: "2026-06-21" });
      const s = computeProjectScheduling(project, TODAY);
      expect(s.isBlocked).toBe(true);
      expect(s.requiredPerDay).toBe(0);
      expect(s.requiredThisWeek).toBe(0);
      expect(s.requiredToday).toBe(0);
    }
  });

  it("returns 0h for completed projects", () => {
    const project = buildProject({ status: "completed" });
    const s = computeProjectScheduling(project, TODAY);
    expect(s.requiredPerDay).toBe(0);
    expect(s.requiredThisWeek).toBe(0);
  });

  it("flags overdue", () => {
    const project = buildProject({
      status: "lineart",
      dueDate: "2026-05-19", // -3 days from TODAY
    });
    const s = computeProjectScheduling(project, TODAY);
    expect(s.isOverdue).toBe(true);
    expect(s.daysUntilDue).toBeLessThan(0);
  });

  it("never divides by zero on due-today projects", () => {
    const project = buildProject({
      status: "lineart",
      dueDate: toISODate(TODAY),
    });
    const s = computeProjectScheduling(project, TODAY);
    expect(s.requiredPerDay).toBeGreaterThan(0);
    expect(Number.isFinite(s.requiredPerDay)).toBe(true);
  });
});

describe("getScheduleEntries sorting", () => {
  it("ranks rush_7 before rush_14 before normal", () => {
    const projects = [
      buildProject({ id: "n", deliveryPlan: "normal" }),
      buildProject({ id: "r14", deliveryPlan: "rush_14_days" }),
      buildProject({ id: "r7", deliveryPlan: "rush_7_days" }),
    ];
    const entries = getScheduleEntries(projects, TODAY);
    expect(entries.map((e) => e.project.id)).toEqual(["r7", "r14", "n"]);
  });

  it("puts non-blocked projects above blocked, and overdue above non-overdue", () => {
    const projects = [
      buildProject({ id: "blocked", status: "awaiting_payment" }),
      buildProject({ id: "active", status: "rough" }),
      buildProject({ id: "overdue", status: "lineart", dueDate: "2026-05-19" }),
    ];
    const entries = getScheduleEntries(projects, TODAY);
    expect(entries[0].project.id).toBe("overdue");
    expect(entries[1].project.id).toBe("active");
    expect(entries[2].project.id).toBe("blocked");
  });

  it("excludes completed projects", () => {
    const projects = [
      buildProject({ id: "done", status: "completed" }),
      buildProject({ id: "alive", status: "rough" }),
    ];
    const entries = getScheduleEntries(projects, TODAY);
    expect(entries.map((e) => e.project.id)).toEqual(["alive"]);
  });
});

describe("getWeeklyForecast", () => {
  it("aggregates required hours and isolates rush + blocked totals", () => {
    const projects = [
      buildProject({ id: "rush", deliveryPlan: "rush_7_days", dueDate: toISODate(new Date(2026, 4, 22 + 7)) }),
      buildProject({ id: "normal", deliveryPlan: "normal", dueDate: "2026-06-21" }),
      buildProject({ id: "wait", status: "awaiting_payment", dueDate: "2026-06-21" }),
    ];
    const entries = getScheduleEntries(projects, TODAY);
    const forecast = getWeeklyForecast(entries);

    expect(forecast.capacityThisWeek).toBe(35); // 5h/day * 7d
    expect(forecast.totalRequiredThisWeek).toBeGreaterThan(0);
    expect(forecast.rushRequiredThisWeek).toBeGreaterThan(0);
    expect(forecast.blockedHours).toBeGreaterThan(0);
    expect(forecast.totalRequiredToday).toBeCloseTo(
      forecast.totalRequiredThisWeek / 7,
      5
    );
  });

  it("honors a custom daily capacity override", () => {
    const projects = [buildProject({ deliveryPlan: "normal" })];
    const entries = getScheduleEntries(projects, TODAY, { dailyCapacityHours: 3 });
    const forecast = getWeeklyForecast(entries, { dailyCapacityHours: 3 });
    expect(forecast.capacityThisWeek).toBe(21);
  });
});

describe("getAwaitingPaymentSummary", () => {
  it("counts only awaiting_payment status and sums amounts", () => {
    const projects = [
      buildProject({ id: "a", status: "awaiting_payment", amount: 5000 }),
      buildProject({ id: "b", status: "awaiting_payment", amount: 8000 }),
      buildProject({ id: "c", status: "quoted", amount: 9000 }), // not counted
      buildProject({ id: "d", status: "rough", amount: 12000 }),
    ];
    const summary = getAwaitingPaymentSummary(projects);
    expect(summary.count).toBe(2);
    expect(summary.totalAmount).toBe(13000);
    expect(summary.projects.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("returns zero state when none awaiting payment", () => {
    const summary = getAwaitingPaymentSummary([
      buildProject({ status: "rough" }),
    ]);
    expect(summary.count).toBe(0);
    expect(summary.totalAmount).toBe(0);
  });
});

describe("delivery plan helper", () => {
  it("returns normal meta for undefined plan", () => {
    const meta = getDeliveryPlanMeta(undefined);
    expect(meta.id).toBe("normal");
    expect(meta.isRush).toBe(false);
    expect(meta.extraFee).toBe(0);
  });

  it.each<[NatoriDeliveryPlan, number, boolean]>([
    ["normal", 0, false],
    ["rush_14_days", 2000, true],
    ["rush_7_days", 2000, true],
  ])("plan %s has fee=%i rush=%j", (plan, fee, rush) => {
    const meta = getDeliveryPlanMeta(plan);
    expect(meta.extraFee).toBe(fee);
    expect(meta.isRush).toBe(rush);
  });
});

describe("formatHours", () => {
  it("formats hours with sensible precision", () => {
    expect(formatHours(0)).toBe("0h");
    expect(formatHours(0.25)).toBe("0.3h");
    expect(formatHours(1.55)).toBe("1.6h");
    expect(formatHours(19)).toBe("19h");
  });
});
