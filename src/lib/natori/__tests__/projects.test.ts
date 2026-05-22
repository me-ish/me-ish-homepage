import { describe, expect, it } from "vitest";
import {
  applyStatusToTasks,
  buildMonthCells,
  calculatePriorityScore,
  createTasksForType,
  daysUntilDue,
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

  it("builds 42 cells covering the requested month", () => {
    const project = buildProject({ id: "x", dueDate: "2026-05-24" });
    const cells = buildMonthCells(2026, 4, [project], TODAY);
    expect(cells).toHaveLength(42);
    const inMonth = cells.filter((cell) => cell.inMonth);
    expect(inMonth.length).toBe(31);
    const target = cells.find((cell) => cell.iso === "2026-05-24");
    expect(target?.projects.map((p) => p.id)).toEqual(["x"]);
    const today = cells.find((cell) => cell.isToday);
    expect(today?.iso).toBe("2026-05-22");
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
    expect(labels).toContain("資料確認");
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

describe("parseISODate / toISODate roundtrip", () => {
  it("converts both directions", () => {
    const date = parseISODate("2026-05-22");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(4);
    expect(date.getDate()).toBe(22);
    expect(toISODate(date)).toBe("2026-05-22");
  });
});
