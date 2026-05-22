import type {
  NatoriPriorityCandidate,
  NatoriProject,
  NatoriProjectStatus,
  NatoriProjectTask,
  NatoriProjectType,
  NatoriTaskStage,
} from "@/types/natori/projects";

export const NATORI_STATUS_ORDER: NatoriProjectStatus[] = [
  "consulting",
  "quoted",
  "awaiting_payment",
  "rough",
  "lineart",
  "coloring",
  "waiting",
  "delivery_prep",
  "delivered",
  "completed",
];

const STAGE_ORDER: NatoriTaskStage[] = [
  "material",
  "rough",
  "lineart",
  "coloring",
  "finish",
  "delivery",
];

const STATUS_AUTOCOMPLETE_THRESHOLD: Record<NatoriProjectStatus, NatoriTaskStage | null> = {
  consulting: null,
  quoted: null,
  awaiting_payment: null,
  rough: "material",
  lineart: "rough",
  coloring: "lineart",
  waiting: "coloring",
  delivery_prep: "finish",
  delivered: "delivery",
  completed: "delivery",
};

const STATUS_CURRENT_STAGE: Record<NatoriProjectStatus, NatoriTaskStage | null> = {
  consulting: null,
  quoted: null,
  awaiting_payment: null,
  rough: "rough",
  lineart: "lineart",
  coloring: "coloring",
  waiting: "finish",
  delivery_prep: "finish",
  delivered: "delivery",
  completed: "delivery",
};

const STATUS_NEXT_ACTION: Record<NatoriProjectStatus, string> = {
  consulting: "依頼内容の確認",
  quoted: "入金確認",
  awaiting_payment: "ラフ開始準備",
  rough: "ラフ提出",
  lineart: "線画作業",
  coloring: "着彩作業",
  waiting: "返信待ち",
  delivery_prep: "納品データ準備",
  delivered: "納品確認",
  completed: "完了",
};

export function getStatusOrderIndex(status: NatoriProjectStatus): number {
  return NATORI_STATUS_ORDER.indexOf(status);
}

export function getNextStatus(status: NatoriProjectStatus): NatoriProjectStatus {
  const idx = getStatusOrderIndex(status);
  if (idx < 0 || idx >= NATORI_STATUS_ORDER.length - 1) return status;
  return NATORI_STATUS_ORDER[idx + 1];
}

export function getPrevStatus(status: NatoriProjectStatus): NatoriProjectStatus {
  const idx = getStatusOrderIndex(status);
  if (idx <= 0) return status;
  return NATORI_STATUS_ORDER[idx - 1];
}

export function getNextActionForStatus(status: NatoriProjectStatus): string {
  return STATUS_NEXT_ACTION[status];
}

export function isDoneStatus(status: NatoriProjectStatus): boolean {
  return status === "delivered" || status === "completed";
}

export function createTasksForType(type: NatoriProjectType): NatoriProjectTask[] {
  switch (type) {
    case "icon":
      return [
        { id: "rough", label: "ラフ", stage: "rough", done: false },
        { id: "lineart", label: "清書", stage: "lineart", done: false },
        { id: "color", label: "着彩", stage: "coloring", done: false },
        { id: "delivery", label: "納品", stage: "delivery", done: false },
      ];
    case "sd":
      return [
        { id: "rough", label: "ラフ", stage: "rough", done: false },
        { id: "lineart", label: "清書", stage: "lineart", done: false },
        { id: "color", label: "着彩", stage: "coloring", done: false },
        { id: "review", label: "最終確認", stage: "finish", done: false },
        { id: "delivery", label: "納品", stage: "delivery", done: false },
      ];
    case "standing":
      return [
        { id: "material", label: "資料確認", stage: "material", done: false },
        { id: "rough", label: "ラフ作成", stage: "rough", done: false },
        { id: "rough-submit", label: "ラフ提出", stage: "rough", done: false },
        { id: "line", label: "線画", stage: "lineart", done: false },
        { id: "color", label: "着彩", stage: "coloring", done: false },
        { id: "expressions", label: "表情差分", stage: "coloring", done: false },
        { id: "review", label: "最終確認", stage: "finish", done: false },
        { id: "delivery", label: "納品", stage: "delivery", done: false },
      ];
    case "illustration":
      return [
        { id: "material", label: "資料確認", stage: "material", done: false },
        { id: "rough", label: "ラフ", stage: "rough", done: false },
        { id: "line", label: "線画", stage: "lineart", done: false },
        { id: "color", label: "着彩", stage: "coloring", done: false },
        { id: "finishing", label: "仕上げ", stage: "finish", done: false },
        { id: "delivery", label: "納品", stage: "delivery", done: false },
      ];
  }
}

export function getTaskProgress(project: NatoriProject) {
  const total = project.tasks.length;
  const done = project.tasks.filter((task) => task.done).length;
  const ratio = total === 0 ? 0 : done / total;
  return { done, total, ratio };
}

export function applyStatusToTasks(
  tasks: NatoriProjectTask[],
  status: NatoriProjectStatus
): NatoriProjectTask[] {
  const threshold = STATUS_AUTOCOMPLETE_THRESHOLD[status];
  if (!threshold) return tasks.map((t) => ({ ...t }));
  const thresholdIdx = STAGE_ORDER.indexOf(threshold);
  return tasks.map((task) => {
    const taskIdx = STAGE_ORDER.indexOf(task.stage);
    if (taskIdx <= thresholdIdx) return { ...task, done: true };
    return { ...task };
  });
}

export function isCurrentStageComplete(project: NatoriProject): boolean {
  const stage = STATUS_CURRENT_STAGE[project.status];
  if (!stage) return false;
  const stageTasks = project.tasks.filter((task) => task.stage === stage);
  if (stageTasks.length === 0) return false;
  return stageTasks.every((task) => task.done);
}

export function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysUntilDue(dueDate: string, today: Date): number {
  const due = parseISODate(dueDate);
  const start = startOfDay(today);
  return Math.round((due.getTime() - start.getTime()) / 86_400_000);
}

export function isProjectOverdue(project: NatoriProject, today: Date): boolean {
  if (isDoneStatus(project.status)) return false;
  return daysUntilDue(project.dueDate, today) < 0;
}

export function getProjectsForDate(projects: NatoriProject[], dateISO: string): NatoriProject[] {
  return projects.filter((project) => project.dueDate === dateISO);
}

export type CalendarCell = {
  date: Date;
  iso: string;
  inMonth: boolean;
  isToday: boolean;
  projects: NatoriProject[];
};

export function buildMonthCells(
  year: number,
  monthIndex: number,
  projects: NatoriProject[],
  today: Date
): CalendarCell[] {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const startWeekday = firstOfMonth.getDay();
  const gridStart = new Date(year, monthIndex, 1 - startWeekday);
  const todayISO = toISODate(today);
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const iso = toISODate(date);
    cells.push({
      date,
      iso,
      inMonth: date.getMonth() === monthIndex,
      isToday: iso === todayISO,
      projects: getProjectsForDate(projects, iso),
    });
  }
  return cells;
}

const TYPE_WEIGHT: Record<NatoriProjectType, number> = {
  icon: 0,
  sd: 3,
  standing: 8,
  illustration: 6,
};

export function calculatePriorityScore(project: NatoriProject, today: Date): number {
  if (isDoneStatus(project.status)) return -1;

  const progress = getTaskProgress(project);
  const days = daysUntilDue(project.dueDate, today);

  let score = 0;
  if (days < 0) {
    score += 1000 + Math.abs(days) * 5;
  } else {
    score += Math.max(0, 14 - days) * 10;
  }

  score += (1 - progress.ratio) * 50;

  if (project.status === "waiting") score -= 25;
  if (project.status === "consulting") score -= 10;
  if (project.status === "quoted" || project.status === "awaiting_payment") score -= 15;

  score += TYPE_WEIGHT[project.type] ?? 0;

  if (project.priority === "high") score += 20;
  if (project.priority === "low") score -= 20;

  return Math.round(score);
}

export function describePriorityReasons(project: NatoriProject, today: Date): string[] {
  const reasons: string[] = [];
  const days = daysUntilDue(project.dueDate, today);
  const progress = getTaskProgress(project);
  const percent = Math.round(progress.ratio * 100);

  if (days < 0) {
    reasons.push(`期限切れ ${Math.abs(days)}日`);
  } else if (days === 0) {
    reasons.push("納期は今日");
  } else if (days <= 3) {
    reasons.push(`納期まで${days}日`);
  } else {
    reasons.push(`納期まで${days}日`);
  }

  reasons.push(`進捗${percent}%`);

  if (project.status === "waiting") {
    reasons.push("返信待ち");
  } else if (project.status === "consulting") {
    reasons.push("打ち合わせ中");
  } else if (project.tasks.some((task) => task.stage === "coloring" && !task.done) && progress.ratio < 0.6) {
    reasons.push("着彩未着手");
  }

  return reasons;
}

export function getPrioritySuggestions(
  projects: NatoriProject[],
  today: Date,
  limit = 3
): NatoriPriorityCandidate[] {
  return projects
    .filter((project) => !isDoneStatus(project.status))
    .map((project) => ({
      project,
      score: calculatePriorityScore(project, today),
      reasons: describePriorityReasons(project, today),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
