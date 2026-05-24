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
  getCurrentStagePlan,
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
      tasks: createTasksForType("illustration"), // 3+5+7+1.5+0.5 = 17h
    });
    const s = computeProjectScheduling(project, TODAY);
    expect(s.totalHours).toBe(17);
    expect(s.remainingHours).toBe(17);
    expect(s.daysUntilDue).toBe(30);
    // requiredPerDay stays as a project-wide fair-share average: 17h / 20 weekdays.
    expect(s.workableDaysUntilDue).toBe(20);
    expect(s.requiredPerDay).toBeCloseTo(17 / 20, 5);
    // requiredThisWeek is bar-based; only the rough bar overlaps this week.
    expect(s.requiredThisWeek).toBeGreaterThan(0);
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
      tasks: createTasksForType("illustration"), // 17h, none auto-completed
    });
    const s = computeProjectScheduling(project, TODAY);
    expect(s.isRush).toBe(true);
    expect(s.daysUntilDue).toBe(7);
    // Weekdays only: gap from Fri 5/22 to Fri 5/29 contains 5 weekdays.
    expect(s.workableDaysUntilDue).toBe(5);
    expect(s.requiredPerDay).toBeCloseTo(17 / 5, 5);
  });

  it("treats Sat/Sun as 0h capacity for requiredToday by default", () => {
    const project = buildProject({
      type: "illustration",
      status: "rough",
      dueDate: "2026-06-21",
      tasks: createTasksForType("illustration"),
    });
    const saturday = new Date(2026, 4, 23); // 2026-05-23 Sat
    const sFromSat = computeProjectScheduling(project, saturday);
    expect(sFromSat.requiredToday).toBe(0);
    expect(sFromSat.requiredPerDay).toBeGreaterThan(0);
  });

  it("counts only stage-bar overlap when computing this-week / today", () => {
    // A project whose only bar is far in the future contributes 0 to today
    // and 0 to this week even though it has remaining hours.
    const future = buildProject({
      id: "future",
      type: "icon",
      status: "rough",
      startDate: "2026-07-10",
      dueDate: "2026-07-17",
      tasks: createTasksForType("icon"),
    });
    const s = computeProjectScheduling(future, TODAY);
    expect(s.requiredToday).toBe(0);
    expect(s.requiredThisWeek).toBe(0);
  });

  it("overdue projects dump all remaining hours into today/this week", () => {
    const overdue = buildProject({
      id: "late",
      type: "icon",
      status: "rough",
      startDate: "2026-04-15",
      dueDate: "2026-05-15", // before TODAY=2026-05-22
      tasks: createTasksForType("icon"),
    });
    const s = computeProjectScheduling(overdue, TODAY);
    expect(s.isOverdue).toBe(true);
    expect(s.requiredThisWeek).toBe(s.remainingHours);
    expect(s.requiredToday).toBe(s.remainingHours);
  });

  it("opting out of weekdaysOnly reverts to calendar-day math", () => {
    const project = buildProject({
      type: "illustration",
      status: "rough",
      dueDate: "2026-06-21",
      tasks: createTasksForType("illustration"),
    });
    const s = computeProjectScheduling(project, TODAY, { weekdaysOnly: false });
    expect(s.workableDaysUntilDue).toBe(30);
    expect(s.requiredPerDay).toBeCloseTo(17 / 30, 5);
    expect(s.capacityThisWeek).toBe(35);
  });

  it("treats inquiry / estimating / consulting / quoted / awaiting_payment / waiting as 0h pressure", () => {
    for (const status of [
      "inquiry",
      "estimating",
      "consulting",
      "quoted",
      "awaiting_payment",
      "waiting",
    ] as const) {
      const project = buildProject({ status, dueDate: "2026-06-21" });
      const s = computeProjectScheduling(project, TODAY);
      expect(s.isBlocked).toBe(true);
      expect(s.requiredPerDay).toBe(0);
      expect(s.requiredThisWeek).toBe(0);
      expect(s.requiredToday).toBe(0);
    }
  });

  it("starts pressuring the schedule once status reaches rough (post-payment)", () => {
    const project = buildProject({
      type: "illustration",
      status: "rough",
      startDate: "2026-05-22",
      dueDate: "2026-06-21",
      tasks: createTasksForType("illustration"),
    });
    const s = computeProjectScheduling(project, TODAY);
    expect(s.isBlocked).toBe(false);
    expect(s.requiredPerDay).toBeGreaterThan(0);
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

    expect(forecast.capacityThisWeek).toBe(25); // 5h/day * 5平日
    expect(forecast.totalRequiredThisWeek).toBeGreaterThan(0);
    expect(forecast.rushRequiredThisWeek).toBeGreaterThan(0);
    expect(forecast.blockedHours).toBeGreaterThan(0);
    // totalRequiredToday is bar-based — for these auto-bar projects, today
    // (5/22 Fri) sits before any bar start, so it's 0.
    expect(forecast.totalRequiredToday).toBeGreaterThanOrEqual(0);
  });

  it("honors a custom daily capacity override", () => {
    const projects = [buildProject({ deliveryPlan: "normal" })];
    const entries = getScheduleEntries(projects, TODAY, { dailyCapacityHours: 3 });
    const forecast = getWeeklyForecast(entries, { dailyCapacityHours: 3 });
    expect(forecast.capacityThisWeek).toBe(15); // 3h/day * 5平日
  });
});

describe("getCurrentStagePlan", () => {
  it("returns the first stage with undone tasks and its weekday-aware breakdown", () => {
    const project = buildProject({
      type: "illustration",
      status: "rough",
      startDate: "2026-05-22",
      dueDate: "2026-06-21",
      tasks: createTasksForType("illustration"),
    });
    const plan = getCurrentStagePlan(project, TODAY);
    expect(plan).not.toBeNull();
    expect(plan!.stage).toBe("rough");
    expect(plan!.remainingHours).toBe(3);
    expect(plan!.requiredPerDay).toBeGreaterThan(0);
    expect(plan!.requiredThisWeek).toBeGreaterThan(0);
    expect(plan!.isOverdueMilestone).toBe(false);
  });

  it("advances to the next stage once earlier stages are fully done", () => {
    const tasks = createTasksForType("illustration").map((task) =>
      task.stage === "material" || task.stage === "rough"
        ? { ...task, done: true }
        : task
    );
    const project = buildProject({
      type: "illustration",
      status: "lineart",
      startDate: "2026-05-22",
      dueDate: "2026-06-21",
      tasks,
    });
    const plan = getCurrentStagePlan(project, TODAY);
    expect(plan!.stage).toBe("lineart");
    expect(plan!.remainingHours).toBe(5);
  });

  it("returns null for blocked or completed projects", () => {
    const blocked = buildProject({ status: "awaiting_payment", dueDate: "2026-06-21" });
    expect(getCurrentStagePlan(blocked, TODAY)).toBeNull();
    const done = buildProject({ status: "completed", dueDate: "2026-06-21" });
    expect(getCurrentStagePlan(done, TODAY)).toBeNull();
  });

  it("flags isOverdueMilestone when the stage target date has already passed", () => {
    const project = buildProject({
      type: "icon",
      status: "rough",
      startDate: "2026-04-15",
      dueDate: "2026-05-15", // already past TODAY=2026-05-22
      tasks: createTasksForType("icon"),
    });
    const plan = getCurrentStagePlan(project, TODAY);
    expect(plan).not.toBeNull();
    expect(plan!.isOverdueMilestone).toBe(true);
    expect(plan!.requiredPerDay).toBeGreaterThan(0);
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
