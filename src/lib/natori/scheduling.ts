import { getDeliveryPlanMeta } from "@/lib/natori/deliveryPlans";
import {
  daysUntilDue,
  isDoneStatus,
  parseISODate,
} from "@/lib/natori/projects";
import type {
  NatoriProject,
  NatoriProjectStatus,
  NatoriProjectTask,
  NatoriTaskStage,
} from "@/types/natori/projects";

export const DEFAULT_DAILY_CAPACITY_HOURS = 5;
export const WEEK_LENGTH_DAYS = 7;
export const WORKDAYS_PER_WEEK = 5;
export const DEFAULT_WEEKDAYS_ONLY = true;

export function isWeekend(date: Date): boolean {
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

// Count Mon-Fri days strictly after `startExclusive` up to and including `endInclusive`.
// Matches the half-open window used by daysUntilDue (today excluded, due included).
export function countWeekdaysInRange(startExclusive: Date, endInclusive: Date): number {
  if (endInclusive.getTime() <= startExclusive.getTime()) return 0;
  let count = 0;
  const cursor = new Date(
    startExclusive.getFullYear(),
    startExclusive.getMonth(),
    startExclusive.getDate() + 1
  );
  const end = new Date(
    endInclusive.getFullYear(),
    endInclusive.getMonth(),
    endInclusive.getDate()
  );
  while (cursor.getTime() <= end.getTime()) {
    if (!isWeekend(cursor)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export const DEFAULT_STAGE_HOURS: Record<NatoriTaskStage, number> = {
  material: 0.5,
  rough: 3,
  lineart: 5,
  coloring: 8,
  finish: 2,
  delivery: 1,
};

// While these statuses are active, no client-side work is consumable. They do not
// pressure the calendar capacity but should still be visible in the dashboard.
const BLOCKED_STATUSES: ReadonlySet<NatoriProjectStatus> = new Set([
  "consulting",
  "quoted",
  "awaiting_payment",
  "waiting",
]);

export function getTaskHours(task: NatoriProjectTask): number {
  return task.estimatedHours ?? DEFAULT_STAGE_HOURS[task.stage];
}

export function getProjectTotalHours(project: NatoriProject): number {
  return project.tasks.reduce((sum, task) => sum + getTaskHours(task), 0);
}

export function getProjectRemainingHours(project: NatoriProject): number {
  return project.tasks
    .filter((task) => !task.done)
    .reduce((sum, task) => sum + getTaskHours(task), 0);
}

export function isBlockedStatus(status: NatoriProjectStatus): boolean {
  return BLOCKED_STATUSES.has(status);
}

export type NatoriProjectScheduling = {
  totalHours: number;
  remainingHours: number;
  daysUntilDue: number;
  workableDaysUntilDue: number;
  isBlocked: boolean;
  isOverdue: boolean;
  isRush: boolean;
  requiredPerDay: number;
  requiredToday: number;
  requiredThisWeek: number;
  capacityThisWeek: number;
  utilizationThisWeek: number;
};

export type NatoriScheduleEntry = {
  project: NatoriProject;
  scheduling: NatoriProjectScheduling;
};

export type NatoriScheduleOptions = {
  dailyCapacityHours?: number;
  /**
   * When true (default), Sat/Sun count as 0h capacity. Per-day, this-week, and
   * capacity-this-week numbers are scaled to a 5-day work week.
   */
  weekdaysOnly?: boolean;
};

export function computeProjectScheduling(
  project: NatoriProject,
  today: Date,
  options: NatoriScheduleOptions = {}
): NatoriProjectScheduling {
  const dailyCapacityHours = options.dailyCapacityHours ?? DEFAULT_DAILY_CAPACITY_HOURS;
  const weekdaysOnly = options.weekdaysOnly ?? DEFAULT_WEEKDAYS_ONLY;
  const totalHours = getProjectTotalHours(project);
  const remainingHours = getProjectRemainingHours(project);
  const days = daysUntilDue(project.dueDate, today);
  const due = parseISODate(project.dueDate);
  const workable = weekdaysOnly
    ? Math.max(1, countWeekdaysInRange(today, due))
    : Math.max(1, days);
  const isBlocked = isBlockedStatus(project.status);
  const done = isDoneStatus(project.status);
  const isOverdue = !done && days < 0;
  const isRush = getDeliveryPlanMeta(project.deliveryPlan).isRush;

  const requiredPerDay = done || isBlocked ? 0 : remainingHours / workable;
  const weekWindow = weekdaysOnly ? WORKDAYS_PER_WEEK : WEEK_LENGTH_DAYS;
  const daysThisWeek = Math.min(weekWindow, workable);
  const requiredThisWeek = done || isBlocked
    ? 0
    : Math.min(remainingHours, requiredPerDay * daysThisWeek);
  const todayCounts = !weekdaysOnly || !isWeekend(today);
  const requiredToday = done || isBlocked || !todayCounts
    ? 0
    : Math.min(remainingHours, requiredPerDay);
  const capacityThisWeek = dailyCapacityHours * weekWindow;
  const utilizationThisWeek = capacityThisWeek === 0 ? 0 : requiredThisWeek / capacityThisWeek;

  return {
    totalHours,
    remainingHours,
    daysUntilDue: days,
    workableDaysUntilDue: workable,
    isBlocked,
    isOverdue,
    isRush,
    requiredPerDay,
    requiredToday,
    requiredThisWeek,
    capacityThisWeek,
    utilizationThisWeek,
  };
}

export function getScheduleEntries(
  projects: NatoriProject[],
  today: Date,
  options: NatoriScheduleOptions = {}
): NatoriScheduleEntry[] {
  return projects
    .filter((project) => !isDoneStatus(project.status))
    .map((project) => ({
      project,
      scheduling: computeProjectScheduling(project, today, options),
    }))
    .sort((a, b) => {
      // Rush projects always come first regardless of blocked state.
      if (a.scheduling.isRush !== b.scheduling.isRush) {
        return a.scheduling.isRush ? -1 : 1;
      }
      // Within rush group, prefer tighter plan (shorter days).
      if (a.scheduling.isRush && b.scheduling.isRush) {
        const aDays = a.project.deliveryPlan === "rush_7_days" ? 7 : 14;
        const bDays = b.project.deliveryPlan === "rush_7_days" ? 7 : 14;
        if (aDays !== bDays) return aDays - bDays;
      }
      // Active (non-blocked) before blocked.
      if (a.scheduling.isBlocked !== b.scheduling.isBlocked) {
        return a.scheduling.isBlocked ? 1 : -1;
      }
      // Overdue first, then highest daily required.
      if (a.scheduling.isOverdue !== b.scheduling.isOverdue) {
        return a.scheduling.isOverdue ? -1 : 1;
      }
      if (a.scheduling.requiredPerDay !== b.scheduling.requiredPerDay) {
        return b.scheduling.requiredPerDay - a.scheduling.requiredPerDay;
      }
      return a.project.dueDate.localeCompare(b.project.dueDate);
    });
}

export type NatoriWeeklyForecast = {
  totalRequiredThisWeek: number;
  capacityThisWeek: number;
  utilizationThisWeek: number;
  totalRequiredToday: number;
  dailyCapacityHours: number;
  rushRequiredThisWeek: number;
  blockedHours: number;
};

export function getWeeklyForecast(
  entries: NatoriScheduleEntry[],
  options: NatoriScheduleOptions = {}
): NatoriWeeklyForecast {
  const dailyCapacityHours = options.dailyCapacityHours ?? DEFAULT_DAILY_CAPACITY_HOURS;
  const weekdaysOnly = options.weekdaysOnly ?? DEFAULT_WEEKDAYS_ONLY;
  const capacityThisWeek = dailyCapacityHours * (weekdaysOnly ? WORKDAYS_PER_WEEK : WEEK_LENGTH_DAYS);

  let totalRequiredThisWeek = 0;
  let totalRequiredToday = 0;
  let rushRequiredThisWeek = 0;
  let blockedHours = 0;

  for (const entry of entries) {
    totalRequiredThisWeek += entry.scheduling.requiredThisWeek;
    totalRequiredToday += entry.scheduling.requiredToday;
    if (entry.scheduling.isRush) rushRequiredThisWeek += entry.scheduling.requiredThisWeek;
    if (entry.scheduling.isBlocked) blockedHours += entry.scheduling.remainingHours;
  }

  return {
    totalRequiredThisWeek,
    capacityThisWeek,
    utilizationThisWeek: capacityThisWeek === 0 ? 0 : totalRequiredThisWeek / capacityThisWeek,
    totalRequiredToday,
    dailyCapacityHours,
    rushRequiredThisWeek,
    blockedHours,
  };
}

export type NatoriAwaitingPaymentSummary = {
  projects: NatoriProject[];
  count: number;
  totalAmount: number;
};

export function getAwaitingPaymentSummary(projects: NatoriProject[]): NatoriAwaitingPaymentSummary {
  const list = projects.filter((project) => project.status === "awaiting_payment");
  const totalAmount = list.reduce((sum, project) => sum + project.amount, 0);
  return { projects: list, count: list.length, totalAmount };
}

export function formatHours(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0h";
  if (value < 1) return `${(Math.round(value * 10) / 10).toFixed(1)}h`;
  if (value < 10) return `${(Math.round(value * 10) / 10).toFixed(1)}h`;
  return `${Math.round(value)}h`;
}
