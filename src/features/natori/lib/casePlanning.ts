import type { CasePlanning } from "./caseScreenContext";
import type { CaseWorkspaceRecord } from "../types/caseWorkspace";
import type { NatoriProject } from "../types/projects";
import {
  calculatePriorityScore,
  computeProjectBars,
  daysUntilDue,
  getTaskProgress,
  isPreworkStatus,
  parseISODate,
} from "./projects";
import { deriveCaseGuidance } from "./caseWorkspacePresentation";
import {sameCaseSourceTime} from "./caseSourceTime";
export const CASE_PLAN_STAGE_LABELS = {
  material: "資料",
  rough: "ラフ",
  lineart: "線画",
  coloring: "着彩",
  finish: "仕上げ",
  delivery: "納品",
};
export function casePlanProject(
  record: CaseWorkspaceRecord,
  rows: CasePlanning | null,
): NatoriProject | null {
  const plan = rows?.find((p) => p.id === record.id),
    fact = record.model.facts.project,
    tasks = record.display.tasks;
  if (
    !plan ||
    fact.state !== "ready" ||
    (tasks.state !== "ready" && tasks.state !== "absent") ||
    !sameCaseSourceTime(plan.updatedAt,fact.value.recordedAt) ||
    plan.dueDate !== record.registeredDueDate ||
    plan.status !== fact.value.rawStatus ||
    plan.type !== fact.value.type ||
    plan.archivedAt !== fact.value.archivedAt
  )
    return null;
  const known = tasks.state === "ready" ? tasks.value : [];
  if (
    known.length !== plan.tasks.length ||
    plan.tasks.some(
      (t) =>
        !known.some(
          (k) => k.id === t.id && k.stage === t.stage && k.done === t.done,
        ),
    )
  )
    return null;
  return {
    id: record.id,
    title: record.title,
    clientName: record.clientLabel,
    type: plan.type,
    status: plan.status,
    amount: null,
    nextAction: "",
    startDate: plan.startDate ?? undefined,
    dueDate: plan.dueDate,
    deliveryPlan: plan.deliveryPlan,
    priority: plan.priority ?? undefined,
    deletedAt: plan.archivedAt ?? undefined,
    tasks: plan.tasks
      .filter((t) => t.stage !== "material")
      .map((t) => ({ ...t, estimatedHours: t.estimatedHours ?? undefined })),
  };
}
export function casePlannedBars(
  record: CaseWorkspaceRecord,
  rows: CasePlanning | null,
  today: string,
) {
  const p = casePlanProject(record, rows);
  if (
    !p ||
    record.model.eligibility !== "active" ||
    record.model.facts.payment.state !== "ready" ||
    isPreworkStatus(p.status)
  )
    return [];
  return computeProjectBars(p, parseISODate(today));
}
export function casePriority(
  record: CaseWorkspaceRecord,
  rows: CasePlanning | null,
  today: string,
) {
  const p = casePlanProject(record, rows);
  if (!p) return null;
  // Reuse the existing numerical estimate, with status categories derived from facts.
  // Raw waiting/awaiting_payment text never supplies the user-facing wait or permission.
  const status: NatoriProject["status"] =
    record.model.eligibility !== "active"
      ? "completed"
      : record.model.facts.payment.state === "ready"
        ? "rough"
        : record.model.stage === "quote_draft"
          ? "estimating"
          : ["quote_issued", "quote_accepted", "payment_available", "payment_notified"].includes(
                record.model.stage,
              )
            ? "quoted"
            : "inquiry";
  const days = p.dueDate ? daysUntilDue(p.dueDate, parseISODate(today)) : null;
  return {
    score: calculatePriorityScore({ ...p, status }, parseISODate(today)),
    reasons: [
      days === null
        ? "登録納期未定"
        : days < 0
          ? `登録納期を${-days}日超過`
          : days === 0
            ? "登録納期は今日"
            : `登録納期まで${days}日`,
      `タスク記録 ${Math.round(getTaskProgress(p).ratio * 100)}%`,
      ...(p.priority && p.priority !== "normal"
        ? [`担当指定の優先度：${p.priority === "high" ? "高" : "低"}`]
        : []),
      deriveCaseGuidance(record).status,
    ],
  };
}
