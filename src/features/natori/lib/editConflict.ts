import { z } from "zod";
import type { NatoriProject } from "../types/projects";

export const projectEditSnapshotSchema = z.object({
  id: z.uuid(), mutationRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  clientName: z.string(), title: z.string(), type: z.string(), amount: z.number().nullable(),
  deliveryPlan: z.enum(["normal", "rush_14_days", "rush_7_days"]),
  startDate: z.string().nullable(), dueDate: z.string().nullable(), note: z.string().nullable(),
  nextAction: z.string(),
});
export type ProjectEditSnapshot = z.infer<typeof projectEditSnapshotSchema>;
export function projectEditSnapshot(project: NatoriProject): ProjectEditSnapshot {
  return { id: project.id, mutationRevision: project.mutationRevision as number,
    clientName: project.clientName, title: project.title, type: project.type, amount: project.amount,
    deliveryPlan: project.deliveryPlan ?? "normal", startDate: project.startDate ?? null,
    dueDate: project.dueDate, note: project.note ?? null, nextAction: project.nextAction };
}
/** Compare only supplied fields. PATCH must never include untouched values. */
export function dirtyFields<T extends object>(base: T, input: T): Partial<T> {
  const patch: Partial<T> = {};
  for (const key of Object.keys(input) as (keyof T)[]) {
    if (!Object.is(base[key], input[key])) patch[key] = input[key];
  }
  return patch;
}
export class NatoriEditConflictError extends Error {
  constructor() { super("別の画面で内容が更新されました。最新の保存済み内容を取得し、入力内容と比較してください。"); this.name = "NatoriEditConflictError"; }
}

export function projectEditValues(project: Pick<ProjectEditSnapshot, "clientName" | "title" | "type" | "amount" | "deliveryPlan" | "startDate" | "dueDate" | "note" | "nextAction">) {
  return { clientName: project.clientName, title: project.title, type: project.type,
    amount: project.amount === null ? "" : String(project.amount), deliveryPlan: project.deliveryPlan ?? "normal",
    startDate: project.startDate ?? "", dueDate: project.dueDate ?? "", note: project.note ?? "", nextAction: project.nextAction };
}
export const PROJECT_EDIT_LABELS = { clientName: "依頼者名", title: "案件タイトル", type: "案件タイプ", amount: "金額", deliveryPlan: "納期プラン", startDate: "開始日", dueDate: "納期", note: "メモ", nextAction: "次のアクション" };
