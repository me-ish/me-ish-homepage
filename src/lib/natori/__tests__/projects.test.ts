import { describe, expect, it } from "vitest";
import {
  applyStatusToTasks,
  assignBarLanes,
  buildMonthCells,
  calculatePriorityScore,
  computeProjectBars,
  computeStageMilestones,
  createTasksForType,
  daysUntilDue,
  deriveNextActionFromTasks,
  deriveStatusFromTasks,
  getActiveBarsForDate,
  getCalendarEntriesForDate,
  getNextActionForStatus,
  getNextStatus,
  getPrevStatus,
  getProjectsForDate,
  getPrioritySuggestions,
  getTaskProgress,
  isCurrentStageComplete,
  isProjectOverdue,
  parseISODate,
  toISODate,
} from "@/lib/natori/projects";
import type { NatoriProject, NatoriProjectStatus, NatoriProjectType } from "@/types/natori/projects";

const TODAY = new Date(2026, 4, 22);

function buildProject(overrides: Partial<NatoriProject> = {}): NatoriProject {
  const type: NatoriProjectType = overrides.type ?? "standing";
  const status: NatoriProjectStatus = overrides.status ?? "rough";
  const base: NatoriProject = {
    id: overrides.id ?? "p-1",
    title: overrides.title ?? "テスト案件",
    clientName: overrides.clientName ?? "テストさん",
    amount: overrides.amount ?? 10000,
    dueDate: overrides.dueDate ?? "2026-05-30",
    status,
    nextAction: overrides.nextAction ?? "ラフ提出",
    type,
    tasks: overrides.tasks ?? createTasksForType(type),
    priority: overrides.priority,
    note: overrides.note,
  };
  return { ...base, ...overrides, tasks: base.tasks };
}

describe("getTaskProgress", () => {
  it("returns 0 ratio when nothing is done", () => {
    const project = buildProject({ type: "icon" });
    const progress = getTaskProgress(project);
    expect(progress.total).toBe(4);
    expect(progress.done).toBe(0);
    expect(progress.ratio).toBe(0);
  });

  it("computes done count and ratio", () => {
    const project = buildProject({
      type: "icon",
      tasks: [
        { id: "rough", label: "ラフ", stage: "rough", done: true },
        { id: "lineart", label: "清書", stage: "lineart", done: true },
        { id: "color", label: "着彩", stage: "coloring", done: false },
        { id: "delivery", label: "納品", stage: "delivery", done: false },
      ],
    });
    const progress = getTaskProgress(project);
    expect(progress.done).toBe(2);
    expect(progress.total).toBe(4);
    expect(progress.ratio).toBe(0.5);
  });
});

describe("daysUntilDue / isProjectOverdue", () => {
  it("computes the difference in days", () => {
    expect(daysUntilDue("2026-05-22", TODAY)).toBe(0);
    expect(daysUntilDue("2026-05-25", TODAY)).toBe(3);
    expect(daysUntilDue("2026-05-20", TODAY)).toBe(-2);
  });

  it("flags overdue active projects", () => {
    const overdue = buildProject({ dueDate: "2026-05-20", status: "lineart" });
    expect(isProjectOverdue(overdue, TODAY)).toBe(true);
  });

  it("never treats delivered projects as overdue", () => {
    const delivered = buildProject({ dueDate: "2026-05-10", status: "delivered" });
    expect(isProjectOverdue(delivered, TODAY)).toBe(false);
  });
});

describe("getProjectsForDate / buildMonthCells", () => {
  it("filters projects by ISO date", () => {
    const a = buildProject({ id: "a", dueDate: "2026-05-24" });
    const b = buildProject({ id: "b", dueDate: "2026-05-24" });
    const c = buildProject({ id: "c", dueDate: "2026-05-25" });
    expect(getProjectsForDate([a, b, c], "2026-05-24").map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("builds 42 cells with lane data covering the requested month", () => {
    const project = buildProject({ id: "x", type: "icon", dueDate: "2026-05-24" });
    const { cells, totalLanes } = buildMonthCells(2026, 4, [project], TODAY);
    expect(cells).toHaveLength(42);
    const inMonth = cells.filter((cell) => cell.inMonth);
    expect(inMonth.length).toBe(31);
    const today = cells.find((cell) => cell.isToday);
    expect(today?.iso).toBe("2026-05-22");
    expect(totalLanes).toBeGreaterThan(0);
    const deliveryDay = cells.find((cell) => cell.iso === "2026-05-24");
    expect(deliveryDay?.lanes.some((entry) => entry?.bar.stage === "delivery" && entry.isEnd)).toBe(true);
  });
});

describe("computeProjectBars", () => {
  it("spreads pending stages across the planned duration and collapses delivery to one day", () => {
    const project = buildProject({
      id: "p1",
      type: "icon",
      startDate: "2026-05-23",
      dueDate: "2026-05-30",
      status: "rough",
    });
    const bars = computeProjectBars(project);
    const byStage = Object.fromEntries(bars.map((b) => [b.stage, b]));
    // 7-day duration, 3 non-delivery stages, 1-day delivery on the due date.
    expect(byStage.rough.startISO).toBe("2026-05-24");
    expect(byStage.rough.endISO).toBe("2026-05-25");
    expect(byStage.lineart.startISO).toBe("2026-05-26");
    expect(byStage.lineart.endISO).toBe("2026-05-27");
    expect(byStage.coloring.startISO).toBe("2026-05-28");
    expect(byStage.coloring.endISO).toBe("2026-05-29");
    expect(byStage.delivery.startISO).toBe("2026-05-30");
    expect(byStage.delivery.endISO).toBe("2026-05-30");
  });

  it("omits bars for stages whose tasks are all done", () => {
    const tasks = createTasksForType("icon").map((task) =>
      task.stage === "rough" ? { ...task, done: true } : task
    );
    const project = buildProject({ id: "p1", type: "icon", tasks, dueDate: "2026-05-30", status: "lineart" });
    const bars = computeProjectBars(project);
    expect(bars.some((b) => b.stage === "rough")).toBe(false);
    expect(bars.some((b) => b.stage === "lineart")).toBe(true);
  });

  it("stretches the first pending stage bar back to today after earlier stages are done", () => {
    const tasks = createTasksForType("icon").map((task) =>
      task.stage === "rough" ? { ...task, done: true } : task
    );
    const project = buildProject({
      id: "p1",
      type: "icon",
      tasks,
      startDate: "2026-05-23",
      dueDate: "2026-05-30",
      status: "lineart",
    });

    const bars = computeProjectBars(project, new Date(2026, 4, 24));
    const lineart = bars.find((bar) => bar.stage === "lineart");
    expect(lineart?.startISO).toBe("2026-05-24");
    expect(lineart?.endISO).toBe("2026-05-27");
    expect(bars.find((bar) => bar.stage === "delivery")?.endISO).toBe("2026-05-30");
  });

  it("returns no bars for delivered/completed projects", () => {
    const project = buildProject({ id: "p1", type: "icon", dueDate: "2026-05-30", status: "delivered" });
    expect(computeProjectBars(project)).toEqual([]);
  });
});

describe("getActiveBarsForDate", () => {
  it("includes every bar whose range covers the date", () => {
    const project = buildProject({
      id: "p1",
      type: "icon",
      startDate: "2026-05-23",
      dueDate: "2026-05-30",
      status: "rough",
    });
    const onStartOfRough = getActiveBarsForDate([project], "2026-05-24", TODAY);
    expect(onStartOfRough).toHaveLength(1);
    expect(onStartOfRough[0].bar.stage).toBe("rough");
    expect(onStartOfRough[0].isStart).toBe(true);

    const onStartOfLineart = getActiveBarsForDate([project], "2026-05-26", TODAY);
    expect(onStartOfLineart[0].bar.stage).toBe("lineart");
    expect(onStartOfLineart[0].isStart).toBe(true);
  });

  it("attaches pending tasks for the bar's stage", () => {
    const tasks = createTasksForType("standing").map((task) =>
      task.id === "rough" ? { ...task, done: true } : task
    );
    const project = buildProject({
      id: "p1",
      type: "standing",
      tasks,
      dueDate: "2026-06-05",
      status: "rough",
    });
    const bars = computeProjectBars(project);
    const roughBar = bars.find((b) => b.stage === "rough")!;
    const entries = getActiveBarsForDate([project], roughBar.startISO, TODAY);
    const roughEntry = entries.find((e) => e.bar.stage === "rough");
    expect(roughEntry?.pendingTasks.map((task) => task.id)).toEqual(["rough-submit"]);
  });

  it("flags entries as overdue when their end is in the past", () => {
    const project = buildProject({ id: "p1", type: "icon", dueDate: "2026-05-20", status: "rough" });
    const bars = computeProjectBars(project);
    const sample = bars[0];
    const entries = getActiveBarsForDate([project], sample.startISO, TODAY);
    expect(entries[0].isOverdue).toBe(true);
  });

  it("returns nothing for delivered projects", () => {
    const project = buildProject({ id: "p1", type: "icon", dueDate: "2026-05-30", status: "delivered" });
    expect(getActiveBarsForDate([project], "2026-05-24", TODAY)).toHaveLength(0);
  });
});

describe("assignBarLanes", () => {
  it("packs non-overlapping bars into the same lane", () => {
    const project = buildProject({ id: "p1", type: "icon", dueDate: "2026-05-30", status: "rough" });
    const bars = computeProjectBars(project);
    const lanes = assignBarLanes(bars);
    const laneNumbers = new Set(lanes.values());
    expect(laneNumbers.size).toBe(1);
    expect(laneNumbers.has(0)).toBe(true);
  });

  it("splits overlapping bars into separate lanes", () => {
    const a = buildProject({ id: "a", type: "icon", dueDate: "2026-05-30", status: "rough" });
    const b = buildProject({ id: "b", type: "icon", dueDate: "2026-05-30", status: "rough" });
    const bars = [...computeProjectBars(a), ...computeProjectBars(b)];
    const lanes = assignBarLanes(bars);
    const aRoughLane = lanes.get("a-rough");
    const bRoughLane = lanes.get("b-rough");
    expect(aRoughLane).not.toBe(bRoughLane);
  });
});

describe("computeStageMilestones", () => {
  it("places delivery on the due date and distributes other stages across the duration", () => {
    const project = buildProject({
      type: "icon",
      startDate: "2026-05-23",
      dueDate: "2026-05-30",
      status: "rough",
    });
    const milestones = computeStageMilestones(project);
    const map = Object.fromEntries(milestones.map((m) => [m.stage, m.dateISO]));
    // 7-day duration → 3 non-delivery stages get gap=2 days, delivery sits on due.
    expect(map.delivery).toBe("2026-05-30");
    expect(map.coloring).toBe("2026-05-29");
    expect(map.lineart).toBe("2026-05-27");
    expect(map.rough).toBe("2026-05-25");
  });

  it("uses only stages that appear in the project's tasks", () => {
    const project = buildProject({
      type: "standing",
      startDate: "2026-05-22",
      dueDate: "2026-06-05",
      status: "rough",
    });
    const milestones = computeStageMilestones(project);
    const stages = milestones.map((m) => m.stage);
    expect(stages).toEqual(["rough", "lineart", "coloring", "finish", "delivery"]);
    // 14-day duration → 4 non-delivery stages get gap=3.25, rough lands ~11 days back from due.
    expect(milestones[0].dateISO).toBe("2026-05-25");
  });

  it("reports allDone for stages whose tasks are all checked", () => {
    const tasks = createTasksForType("icon").map((task) =>
      task.stage === "rough" ? { ...task, done: true } : task
    );
    const project = buildProject({ type: "icon", tasks, dueDate: "2026-05-30", status: "lineart" });
    const milestones = computeStageMilestones(project);
    const rough = milestones.find((m) => m.stage === "rough");
    const lineart = milestones.find((m) => m.stage === "lineart");
    expect(rough?.allDone).toBe(true);
    expect(lineart?.allDone).toBe(false);
  });
});

describe("getCalendarEntriesForDate", () => {
  it("yields due entries when the date matches a project's dueDate", () => {
    const project = buildProject({ id: "p1", type: "icon", dueDate: "2026-05-30", status: "rough" });
    const entries = getCalendarEntriesForDate([project], "2026-05-30");
    expect(entries.some((e) => e.kind === "due")).toBe(true);
  });

  it("yields milestone entries for pending stages on their milestone date", () => {
    const project = buildProject({
      id: "p1",
      type: "icon",
      startDate: "2026-05-23",
      dueDate: "2026-05-30",
      status: "rough",
    });
    const entries = getCalendarEntriesForDate([project], "2026-05-25");
    const milestone = entries.find((e) => e.kind === "milestone");
    expect(milestone && milestone.kind === "milestone" ? milestone.stage : null).toBe("rough");
  });

  it("skips milestone entries for stages whose tasks are all done", () => {
    const tasks = createTasksForType("icon").map((task) =>
      task.stage === "rough" ? { ...task, done: true } : task
    );
    const project = buildProject({ id: "p1", type: "icon", tasks, dueDate: "2026-05-30", status: "lineart" });
    const entries = getCalendarEntriesForDate([project], "2026-05-24");
    expect(entries.find((e) => e.kind === "milestone" && e.stage === "rough")).toBeUndefined();
  });

  it("does not emit a milestone entry for the delivery stage (covered by the due entry)", () => {
    const project = buildProject({ id: "p1", type: "icon", dueDate: "2026-05-30", status: "rough" });
    const entries = getCalendarEntriesForDate([project], "2026-05-30");
    expect(entries.filter((e) => e.kind === "milestone" && e.stage === "delivery")).toHaveLength(0);
  });

  it("skips milestones for delivered or completed projects", () => {
    const project = buildProject({ id: "p1", type: "icon", dueDate: "2026-05-30", status: "delivered" });
    const entries = getCalendarEntriesForDate([project], "2026-05-24");
    expect(entries.filter((e) => e.kind === "milestone")).toHaveLength(0);
  });

  it("sorts due entries before milestones", () => {
    const projectA = buildProject({ id: "a", type: "icon", dueDate: "2026-05-30", status: "rough" });
    const projectB = buildProject({ id: "b", type: "icon", dueDate: "2026-06-05", status: "rough" });
    const entries = getCalendarEntriesForDate([projectA, projectB], "2026-05-30");
    expect(entries[0]?.kind).toBe("due");
  });
});

describe("status transitions", () => {
  it("advances and retreats statuses safely", () => {
    expect(getNextStatus("rough")).toBe("lineart");
    expect(getPrevStatus("lineart")).toBe("rough");
    expect(getNextStatus("completed")).toBe("completed");
    expect(getPrevStatus("consulting")).toBe("consulting");
  });

  it("returns a next action for each status", () => {
    expect(getNextActionForStatus("rough")).toBe("ラフ提出");
    expect(getNextActionForStatus("lineart")).toBe("線画作業");
    expect(getNextActionForStatus("waiting")).toBe("返信待ち");
  });
});

describe("applyStatusToTasks", () => {
  it("auto-completes prior stages when moving forward", () => {
    const project = buildProject({ type: "standing", status: "rough" });
    const after = applyStatusToTasks(project.tasks, "coloring");
    const labels = after.filter((task) => task.done).map((task) => task.label);
    expect(labels).toContain("ラフ作成");
    expect(labels).toContain("ラフ提出");
    expect(labels).toContain("線画");
    expect(labels).not.toContain("表情差分");
    expect(labels).not.toContain("納品");
  });

  it("does not uncheck manual completions when threshold is null", () => {
    const tasks = createTasksForType("icon").map((task) =>
      task.id === "rough" ? { ...task, done: true } : task
    );
    const after = applyStatusToTasks(tasks, "consulting");
    expect(after.find((task) => task.id === "rough")?.done).toBe(true);
  });

  it("marks every task as done when reaching delivered", () => {
    const tasks = createTasksForType("sd");
    const after = applyStatusToTasks(tasks, "delivered");
    expect(after.every((task) => task.done)).toBe(true);
  });
});

describe("isCurrentStageComplete", () => {
  it("is true when every task in the current status's stage is done", () => {
    const tasks = createTasksForType("standing").map((task) =>
      task.stage === "rough" ? { ...task, done: true } : task
    );
    const project = buildProject({ type: "standing", status: "rough", tasks });
    expect(isCurrentStageComplete(project)).toBe(true);
  });

  it("is false when any task in the current stage is still pending", () => {
    const project = buildProject({ type: "standing", status: "rough" });
    expect(isCurrentStageComplete(project)).toBe(false);
  });
});

describe("calculatePriorityScore / getPrioritySuggestions", () => {
  it("ranks an overdue project above non-overdue ones", () => {
    const overdue = buildProject({ id: "overdue", dueDate: "2026-05-20", status: "lineart" });
    const calm = buildProject({ id: "calm", dueDate: "2026-06-15", status: "rough" });
    expect(calculatePriorityScore(overdue, TODAY)).toBeGreaterThan(
      calculatePriorityScore(calm, TODAY)
    );
  });

  it("ranks a near-deadline low-progress standing project above a near-deadline high-progress waiting one", () => {
    const urgent = buildProject({
      id: "urgent",
      type: "standing",
      status: "rough",
      dueDate: "2026-05-25",
    });
    const waiting = buildProject({
      id: "waiting",
      type: "icon",
      status: "waiting",
      dueDate: "2026-05-24",
      tasks: createTasksForType("icon").map((task, idx) => ({
        ...task,
        done: idx < 3,
      })),
    });
    const scoreUrgent = calculatePriorityScore(urgent, TODAY);
    const scoreWaiting = calculatePriorityScore(waiting, TODAY);
    expect(scoreUrgent).toBeGreaterThan(scoreWaiting);
  });

  it("excludes done projects from suggestions", () => {
    const done = buildProject({ id: "done", status: "delivered" });
    const open = buildProject({ id: "open", status: "rough", dueDate: "2026-05-30" });
    const suggestions = getPrioritySuggestions([done, open], TODAY, 5);
    expect(suggestions.map((s) => s.project.id)).toEqual(["open"]);
  });

  it("limits results to the requested size", () => {
    const projects = Array.from({ length: 5 }, (_, idx) =>
      buildProject({ id: `p-${idx}`, dueDate: `2026-05-${25 + idx}` })
    );
    expect(getPrioritySuggestions(projects, TODAY, 3)).toHaveLength(3);
  });
});

describe("deriveStatusFromTasks", () => {
  it("returns completed once every task is done", () => {
    const tasks = createTasksForType("icon").map((task) => ({ ...task, done: true }));
    expect(deriveStatusFromTasks(tasks, "rough")).toBe("completed");
  });

  it("preserves pre-work statuses when no task is started", () => {
    const tasks = createTasksForType("sd");
    expect(deriveStatusFromTasks(tasks, "consulting")).toBe("consulting");
    expect(deriveStatusFromTasks(tasks, "awaiting_payment")).toBe("awaiting_payment");
  });

  it("falls back to rough when no task done and status is not pre-work", () => {
    const tasks = createTasksForType("icon");
    expect(deriveStatusFromTasks(tasks, "lineart")).toBe("rough");
  });

  it("maps the first pending task's stage to a working status", () => {
    const tasks = createTasksForType("standing").map((task) =>
      task.stage === "material" || task.stage === "rough"
        ? { ...task, done: true }
        : task
    );
    expect(deriveStatusFromTasks(tasks, "rough")).toBe("lineart");

    const further = tasks.map((task) =>
      task.stage === "lineart" ? { ...task, done: true } : task
    );
    expect(deriveStatusFromTasks(further, "lineart")).toBe("coloring");
  });

  it("maps remaining finish/delivery tasks to delivery_prep", () => {
    const tasks = createTasksForType("sd").map((task) =>
      task.stage === "delivery" ? task : { ...task, done: true }
    );
    expect(deriveStatusFromTasks(tasks, "coloring")).toBe("delivery_prep");
  });
});

describe("deriveNextActionFromTasks", () => {
  it("returns the first pending task label", () => {
    const tasks = createTasksForType("standing").map((task) =>
      task.stage === "material" ? { ...task, done: true } : task
    );
    expect(deriveNextActionFromTasks(tasks, "fallback")).toBe("ラフ作成");
  });

  it("returns 完了 when every task is done", () => {
    const tasks = createTasksForType("icon").map((task) => ({ ...task, done: true }));
    expect(deriveNextActionFromTasks(tasks, "fallback")).toBe("完了");
  });
});

describe("parseISODate / toISODate roundtrip", () => {
  it("converts both directions", () => {
    const date = parseISODate("2026-05-22");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(4);
    expect(date.getDate()).toBe(22);
    expect(toISODate(date)).toBe("2026-05-22");
  });
});
