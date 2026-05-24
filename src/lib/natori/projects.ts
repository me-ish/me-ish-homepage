import { getDeliveryPlanMeta } from "@/lib/natori/deliveryPlans";
import type {
  NatoriCalendarBar,
  NatoriCalendarCellBar,
  NatoriCalendarEntry,
  NatoriPriorityCandidate,
  NatoriProject,
  NatoriProjectStatus,
  NatoriProjectTask,
  NatoriProjectType,
  NatoriStageMilestone,
  NatoriTaskStage,
} from "@/types/natori/projects";

// Production flow (2026-05): 依頼 → 見積もり → 案件化 → 入金待ち → 入金確認 → ラフ → ….
// "consulting" is the legacy "依頼受付" value; kept in the order list for
// back-compat with existing DB rows but treated identically to inquiry.
export const NATORI_STATUS_ORDER: NatoriProjectStatus[] = [
  "inquiry",
  "estimating",
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
  inquiry: null,
  estimating: null,
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

export function getStageForStatus(status: NatoriProjectStatus): NatoriTaskStage | null {
  return STATUS_CURRENT_STAGE[status];
}

const STATUS_CURRENT_STAGE: Record<NatoriProjectStatus, NatoriTaskStage | null> = {
  inquiry: null,
  estimating: null,
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
  inquiry: "依頼内容の確認・見積もり作成",
  estimating: "見積もり提示",
  consulting: "依頼内容の確認・見積もり作成",
  quoted: "案件化（入金待ちへ）",
  awaiting_payment: "入金確認後、ラフ開始",
  rough: "ラフ提出",
  lineart: "線画作業",
  coloring: "着彩作業",
  waiting: "返信待ち",
  delivery_prep: "納品データ準備",
  delivered: "納品確認",
  completed: "完了",
};

// User-facing button label for advancing a project to the next status. For
// the active production stages (rough → … → delivered) we keep these in sync
// with the natural flow, even though the dashboard typically advances those
// via task-checklist toggling.
const STATUS_ADVANCE_BUTTON_LABEL: Record<NatoriProjectStatus, string | null> = {
  inquiry: "見積もり作成へ",
  estimating: "見積もり提示済みにする",
  consulting: "見積もり作成へ",
  quoted: "案件化して入金待ちにする",
  awaiting_payment: "入金確認してラフ開始",
  rough: "線画へ進む",
  lineart: "着彩へ進む",
  coloring: "納品準備へ進む",
  waiting: "次工程へ進む",
  delivery_prep: "納品済みにする",
  delivered: "完了にする",
  completed: null,
};

export function getAdvanceButtonLabel(status: NatoriProjectStatus): string | null {
  return STATUS_ADVANCE_BUTTON_LABEL[status];
}

// Map legacy / alias statuses onto the canonical flow so ordering, advancing
// and "prework" checks stay consistent. consulting → inquiry.
function canonicalizeStatus(status: NatoriProjectStatus): NatoriProjectStatus {
  if (status === "consulting") return "inquiry";
  return status;
}

export function getStatusOrderIndex(status: NatoriProjectStatus): number {
  return NATORI_STATUS_ORDER.indexOf(canonicalizeStatus(status));
}

export function getNextStatus(status: NatoriProjectStatus): NatoriProjectStatus {
  const idx = getStatusOrderIndex(status);
  if (idx < 0 || idx >= NATORI_STATUS_ORDER.length - 1) return canonicalizeStatus(status);
  return NATORI_STATUS_ORDER[idx + 1];
}

export function getPrevStatus(status: NatoriProjectStatus): NatoriProjectStatus {
  const idx = getStatusOrderIndex(status);
  if (idx <= 0) return canonicalizeStatus(status);
  return NATORI_STATUS_ORDER[idx - 1];
}

export function getNextActionForStatus(status: NatoriProjectStatus): string {
  return STATUS_NEXT_ACTION[status];
}

export function isDoneStatus(status: NatoriProjectStatus): boolean {
  return status === "delivered" || status === "completed";
}

// キャラクター系 3 タイプ（胸上 / 膝〜腰上 / 全身）の共通タスクテンプレ。
// ラフ作成 → ラフ提出 → 線画 → 着彩 → 最終確認 → 納品 の 6 工程で統一する。
// 表情差分は本人の運用ヒアリングで除外。納期負荷の違いは estimatedHours で吸収。
function createCharacterTasks(hours: {
  roughCreate: number;
  roughSubmit: number;
  lineart: number;
  color: number;
  review: number;
  delivery: number;
}): NatoriProjectTask[] {
  return [
    { id: "rough", label: "ラフ作成", stage: "rough", done: false, estimatedHours: hours.roughCreate },
    { id: "rough-submit", label: "ラフ提出", stage: "rough", done: false, estimatedHours: hours.roughSubmit },
    { id: "lineart", label: "線画", stage: "lineart", done: false, estimatedHours: hours.lineart },
    { id: "color", label: "着彩", stage: "coloring", done: false, estimatedHours: hours.color },
    { id: "review", label: "最終確認", stage: "finish", done: false, estimatedHours: hours.review },
    { id: "delivery", label: "納品", stage: "delivery", done: false, estimatedHours: hours.delivery },
  ];
}

export function createTasksForType(type: NatoriProjectType): NatoriProjectTask[] {
  switch (type) {
    case "icon":
      return createCharacterTasks({
        roughCreate: 1,
        roughSubmit: 0.5,
        lineart: 1,
        color: 1.5,
        review: 0.5,
        delivery: 0.5,
      });
    case "sd":
      return createCharacterTasks({
        roughCreate: 1.5,
        roughSubmit: 0.5,
        lineart: 2.5,
        color: 4,
        review: 1,
        delivery: 1,
      });
    case "standing":
      return createCharacterTasks({
        roughCreate: 3,
        roughSubmit: 0.5,
        lineart: 6,
        color: 10,
        review: 1,
        delivery: 0.5,
      });
    case "illustration":
      return [
        { id: "rough", label: "ラフ", stage: "rough", done: false, estimatedHours: 3 },
        { id: "line", label: "線画", stage: "lineart", done: false, estimatedHours: 5 },
        { id: "color", label: "着彩", stage: "coloring", done: false, estimatedHours: 7 },
        { id: "finishing", label: "仕上げ", stage: "finish", done: false, estimatedHours: 1.5 },
        { id: "delivery", label: "納品", stage: "delivery", done: false, estimatedHours: 0.5 },
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

const STAGE_TO_STATUS: Record<NatoriTaskStage, NatoriProjectStatus> = {
  material: "rough",
  rough: "rough",
  lineart: "lineart",
  coloring: "coloring",
  finish: "delivery_prep",
  delivery: "delivery_prep",
};

const PREWORK_STATUSES: NatoriProjectStatus[] = [
  "inquiry",
  "estimating",
  "consulting",
  "quoted",
  "awaiting_payment",
];

export function isPreworkStatus(status: NatoriProjectStatus): boolean {
  return PREWORK_STATUSES.includes(status);
}

export function deriveStatusFromTasks(
  tasks: NatoriProjectTask[],
  currentStatus: NatoriProjectStatus
): NatoriProjectStatus {
  if (tasks.length === 0) return currentStatus;
  const done = tasks.filter((task) => task.done).length;
  if (done === tasks.length) return "completed";
  if (done === 0) {
    if (PREWORK_STATUSES.includes(currentStatus)) return currentStatus;
    return "rough";
  }
  const firstPending = tasks.find((task) => !task.done);
  if (!firstPending) return "completed";
  return STAGE_TO_STATUS[firstPending.stage];
}

export function deriveNextActionFromTasks(
  tasks: NatoriProjectTask[],
  fallback: string
): string {
  if (tasks.length === 0) return fallback;
  const firstPending = tasks.find((task) => !task.done);
  if (!firstPending) return "完了";
  return firstPending.label;
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

/**
 * Returns the planned duration of the project in days. Prefers an explicit
 * startDate; falls back to the delivery plan's nominal days.
 */
export function getProjectDurationDays(project: NatoriProject): number {
  if (project.startDate) {
    const start = parseISODate(project.startDate);
    const due = parseISODate(project.dueDate);
    const diff = Math.round((due.getTime() - start.getTime()) / 86_400_000);
    if (diff > 0) return diff;
  }
  return getDeliveryPlanMeta(project.deliveryPlan).days;
}

export function computeStageMilestones(project: NatoriProject): NatoriStageMilestone[] {
  const ordered: NatoriTaskStage[] = ["material", "rough", "lineart", "coloring", "finish", "delivery"];
  const usedStages = ordered.filter((stage) =>
    project.tasks.some((task) => task.stage === stage)
  );
  if (usedStages.length === 0) return [];

  const due = parseISODate(project.dueDate);
  const duration = getProjectDurationDays(project);
  const hasDelivery = usedStages[usedStages.length - 1] === "delivery";
  const nonDeliveryStages = hasDelivery ? usedStages.slice(0, -1) : usedStages;
  const nonDeliveryCount = nonDeliveryStages.length;
  // Delivery is collapsed onto the due date as a 1-day marker, so non-delivery
  // stages share the remaining window.
  const availableDays = Math.max(0, duration - (hasDelivery ? 1 : 0));

  const milestones: NatoriStageMilestone[] = [];

  if (nonDeliveryCount > 0) {
    const gap = availableDays / nonDeliveryCount;
    nonDeliveryStages.forEach((stage, idx) => {
      const rawOffset = (nonDeliveryCount - 1 - idx) * gap + (hasDelivery ? 1 : 0);
      const offset = Math.max(hasDelivery ? 1 : 0, Math.round(rawOffset));
      const date = new Date(due.getFullYear(), due.getMonth(), due.getDate() - offset);
      const stageTasks = project.tasks.filter((task) => task.stage === stage);
      const allDone = stageTasks.every((task) => task.done);
      milestones.push({ stage, dateISO: toISODate(date), allDone });
    });
  }

  if (hasDelivery) {
    const stageTasks = project.tasks.filter((task) => task.stage === "delivery");
    milestones.push({
      stage: "delivery",
      dateISO: toISODate(due),
      allDone: stageTasks.every((task) => task.done),
    });
  }

  return milestones;
}

const STAGE_SORT_ORDER: NatoriTaskStage[] = [
  "material",
  "rough",
  "lineart",
  "coloring",
  "finish",
  "delivery",
];

export function getCalendarEntriesForDate(
  projects: NatoriProject[],
  dateISO: string
): NatoriCalendarEntry[] {
  const entries: NatoriCalendarEntry[] = [];

  for (const project of projects) {
    if (project.dueDate === dateISO) {
      entries.push({ kind: "due", project });
    }
    if (isDoneStatus(project.status)) continue;
    // Pre-work case の milestone（rough/lineart/...）はまだ着手しないので
    // カレンダーに点として出さない。due だけ残してクリックで詳細に飛べる。
    if (isPreworkStatus(project.status)) continue;
    const milestones = computeStageMilestones(project);
    for (const milestone of milestones) {
      if (milestone.stage === "delivery") continue;
      if (milestone.allDone) continue;
      if (milestone.dateISO !== dateISO) continue;
      entries.push({
        kind: "milestone",
        project,
        stage: milestone.stage,
        allDone: milestone.allDone,
      });
    }
  }

  return entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "due" ? -1 : 1;
    if (a.kind === "due" || b.kind === "due") return 0;
    return STAGE_SORT_ORDER.indexOf(a.stage) - STAGE_SORT_ORDER.indexOf(b.stage);
  });
}

function shiftISODate(iso: string, days: number): string {
  const date = parseISODate(iso);
  return toISODate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
}

export function computeProjectBars(project: NatoriProject, today?: Date): NatoriCalendarBar[] {
  if (isDoneStatus(project.status)) return [];
  // Pre-work (依頼受付・見積もり中・見積もり提示済み・入金待ち) は制作未着手なので
  // カレンダーの stage バーには出さない。入金確認 → rough に進んでから初めて
  // バーが描画されるようにする。
  if (isPreworkStatus(project.status)) return [];
  const milestones = computeStageMilestones(project);
  if (milestones.length === 0) return [];

  const duration = getProjectDurationDays(project);
  const due = parseISODate(project.dueDate);
  const todayISO = today ? toISODate(today) : null;
  const startISOFirst = toISODate(
    new Date(due.getFullYear(), due.getMonth(), due.getDate() - (duration - 1))
  );
  const firstPendingIndex = milestones.findIndex((milestone) => !milestone.allDone);

  const bars: NatoriCalendarBar[] = [];
  for (let i = 0; i < milestones.length; i += 1) {
    const milestone = milestones[i];
    if (milestone.allDone) continue;
    const endISO = milestone.dateISO;
    const rawStart =
      i === 0 ? startISOFirst : shiftISODate(milestones[i - 1].dateISO, 1);
    const hasCompletedPreviousStage = milestones
      .slice(0, i)
      .some((previous) => previous.allDone);
    const stretchedStart =
      todayISO &&
      i === firstPendingIndex &&
      hasCompletedPreviousStage &&
      todayISO >= startISOFirst &&
      todayISO < rawStart &&
      todayISO <= endISO
        ? todayISO
        : rawStart;
    const startISO = stretchedStart > endISO ? endISO : stretchedStart;
    bars.push({
      id: `${project.id}-${milestone.stage}`,
      project,
      stage: milestone.stage,
      startISO,
      endISO,
    });
  }
  return bars;
}

export type ActiveBarOnDate = {
  bar: NatoriCalendarBar;
  isStart: boolean;
  isEnd: boolean;
  isOverdue: boolean;
  pendingTasks: NatoriProjectTask[];
};

export function getActiveBarsForDate(
  projects: NatoriProject[],
  dateISO: string,
  today: Date
): ActiveBarOnDate[] {
  const todayISO = toISODate(today);
  const results: ActiveBarOnDate[] = [];
  for (const project of projects) {
    const bars = computeProjectBars(project, today);
    for (const bar of bars) {
      if (bar.startISO > dateISO || bar.endISO < dateISO) continue;
      const pendingTasks = project.tasks.filter(
        (task) => task.stage === bar.stage && !task.done
      );
      results.push({
        bar,
        isStart: bar.startISO === dateISO,
        isEnd: bar.endISO === dateISO,
        isOverdue: bar.endISO < todayISO,
        pendingTasks,
      });
    }
  }
  return results.sort((a, b) => {
    const stageDiff =
      STAGE_SORT_ORDER.indexOf(a.bar.stage) - STAGE_SORT_ORDER.indexOf(b.bar.stage);
    if (stageDiff !== 0) return stageDiff;
    return a.bar.project.id.localeCompare(b.bar.project.id);
  });
}

export function assignBarLanes(bars: NatoriCalendarBar[]): Map<string, number> {
  const sorted = bars.slice().sort((a, b) => {
    if (a.startISO !== b.startISO) return a.startISO.localeCompare(b.startISO);
    if (a.project.id !== b.project.id) return a.project.id.localeCompare(b.project.id);
    return STAGE_SORT_ORDER.indexOf(a.stage) - STAGE_SORT_ORDER.indexOf(b.stage);
  });
  const laneEndISOs: string[] = [];
  const result = new Map<string, number>();
  for (const bar of sorted) {
    let laneIdx = 0;
    while (laneIdx < laneEndISOs.length && laneEndISOs[laneIdx] >= bar.startISO) {
      laneIdx += 1;
    }
    laneEndISOs[laneIdx] = bar.endISO;
    result.set(bar.id, laneIdx);
  }
  return result;
}

export type CalendarCell = {
  date: Date;
  iso: string;
  inMonth: boolean;
  isToday: boolean;
  lanes: Array<NatoriCalendarCellBar | null>;
};

export type MonthCalendarLayout = {
  cells: CalendarCell[];
  totalLanes: number;
};

export function buildMonthCells(
  year: number,
  monthIndex: number,
  projects: NatoriProject[],
  today: Date
): MonthCalendarLayout {
  const allBars = projects.flatMap((project) => computeProjectBars(project, today));
  const laneMap = assignBarLanes(allBars);
  const totalLanes = allBars.reduce((max, bar) => {
    const lane = laneMap.get(bar.id) ?? 0;
    return Math.max(max, lane + 1);
  }, 0);

  const todayISO = toISODate(today);
  const firstOfMonth = new Date(year, monthIndex, 1);
  const startWeekday = firstOfMonth.getDay();
  const gridStart = new Date(year, monthIndex, 1 - startWeekday);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const iso = toISODate(date);
    const lanes: Array<NatoriCalendarCellBar | null> = Array(totalLanes).fill(null);
    for (const bar of allBars) {
      if (bar.startISO <= iso && bar.endISO >= iso) {
        const laneIdx = laneMap.get(bar.id) ?? 0;
        lanes[laneIdx] = {
          bar,
          isStart: bar.startISO === iso,
          isEnd: bar.endISO === iso,
          isOverdue: bar.endISO < todayISO,
        };
      }
    }
    cells.push({
      date,
      iso,
      inMonth: date.getMonth() === monthIndex,
      isToday: iso === todayISO,
      lanes,
    });
  }

  return { cells, totalLanes };
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
  if (
    project.status === "inquiry" ||
    project.status === "estimating" ||
    project.status === "consulting"
  ) {
    score -= 10;
  }
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
  } else if (project.status === "inquiry" || project.status === "consulting") {
    reasons.push("依頼受付");
  } else if (project.status === "estimating") {
    reasons.push("見積もり中");
  } else if (project.status === "quoted") {
    reasons.push("見積もり提示済み");
  } else if (project.status === "awaiting_payment") {
    reasons.push("入金待ち");
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
