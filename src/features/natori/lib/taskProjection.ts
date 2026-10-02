import { z } from "zod";
import type { NatoriDeliveryPlan, NatoriProject, NatoriProjectPriority, NatoriProjectTask } from "../types/projects";
import { readNatoriProjectType } from "./projectReadModel";

const statuses = z.enum(["inquiry", "estimating", "consulting", "quoted", "awaiting_payment", "rough", "lineart", "coloring", "waiting", "delivery_prep", "delivered", "completed", "closed"]);
export const taskProjectionSchema = z.object({
  id: z.uuid(), status: statuses, nextAction: z.string(),
  title: z.string(), clientName: z.string(), clientEmail: z.string().nullable(),
  amount: z.number().nullable(), type: z.string(), deliveryPlan: z.string(),
  priority: z.string().nullable(), startDate: z.string().nullable(), dueDate: z.string().nullable(),
  createdAt: z.string(), note: z.string().nullable(), requestData: z.json().nullable(),
  mutationRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  tasks: z.array(z.object({ id: z.string(), label: z.string(),
    stage: z.enum(["material", "rough", "lineart", "coloring", "finish", "delivery"]),
    done: z.boolean(), estimatedHours: z.number().nullable().optional() })),
  paymentConfirmedAt: z.string().nullable(), paidAt: z.string().nullable(),
  paidAmount: z.number().int().nullable(), completedAt: z.string().nullable(),
  deliveryAcceptedAt: z.string().nullable(), deliveredMailAt: z.string().nullable(),
  deletedAt: z.string().nullable(),
});
export type NatoriTaskProjection = z.infer<typeof taskProjectionSchema>;
export type TaskIntent = { sequence: number; done: boolean };

/** Match the existing GET read model without inventing or writing a paid_at fact. */
export function effectivePaidAt(paidAt: string | null | undefined, paymentConfirmedAt: string | null | undefined): string | undefined {
  return paidAt ?? paymentConfirmedAt ?? undefined;
}

/** A task response can never undo independently confirmed lifecycle facts. */
export function applyTaskProjection(current: NatoriProject, incoming: NatoriTaskProjection): NatoriProject {
  if (incoming.id !== current.id || incoming.mutationRevision <= (current.mutationRevision ?? -1)) return current;
  if (current.status === "closed" && incoming.status !== "closed") return current;
  if (current.status === "delivered" && !["delivered", "completed"].includes(incoming.status)) return current;
  if ((current.status === "completed" || current.completedAt || current.deliveryAcceptedAt) &&
      (incoming.status !== "completed" || incoming.completedAt !== (current.completedAt ?? incoming.completedAt) ||
       incoming.deliveryAcceptedAt !== (current.deliveryAcceptedAt ?? incoming.deliveryAcceptedAt))) return current;
  if (current.paymentConfirmedAt && incoming.paymentConfirmedAt !== current.paymentConfirmedAt) return current;
  const incomingPaidAt = effectivePaidAt(incoming.paidAt, incoming.paymentConfirmedAt);
  if (current.paidAt && incomingPaidAt !== current.paidAt) return current;
  if (current.paidAmount !== undefined && incoming.paidAmount !== current.paidAmount) return current;
  if (current.deliveredMailAt && incoming.deliveredMailAt !== current.deliveredMailAt) return current;
  if (current.deletedAt && incoming.deletedAt !== current.deletedAt) return current;
  return { ...current, status: incoming.status, nextAction: incoming.nextAction, mutationRevision: incoming.mutationRevision,
    title: incoming.title, clientName: incoming.clientName, clientEmail: incoming.clientEmail ?? undefined,
    amount: incoming.amount, type: readNatoriProjectType(incoming.type), deliveryPlan: incoming.deliveryPlan as NatoriDeliveryPlan,
    priority: (incoming.priority ?? undefined) as NatoriProjectPriority | undefined,
    startDate: incoming.startDate ?? undefined, dueDate: incoming.dueDate, createdAt: incoming.createdAt,
    note: incoming.note ?? undefined, requestData: incoming.requestData ?? undefined,
    tasks: incoming.tasks.filter(task => task.stage !== "material").map(task => ({ ...task, estimatedHours: task.estimatedHours ?? undefined })),
    paymentConfirmedAt: incoming.paymentConfirmedAt ?? undefined, paidAt: incomingPaidAt,
    paidAmount: incoming.paidAmount ?? undefined, completedAt: incoming.completedAt ?? undefined,
    deliveryAcceptedAt: incoming.deliveryAcceptedAt ?? undefined, deliveredMailAt: incoming.deliveredMailAt ?? undefined,
    deletedAt: incoming.deletedAt ?? undefined };
}

/** Pending local checkbox intents never predict a business status or completion. */
export function overlayTaskIntents(project: NatoriProject, intents?: ReadonlyMap<string, TaskIntent>): NatoriProject {
  if (!intents?.size) return project;
  return { ...project, tasks: project.tasks.map(task => {
    const intent = intents.get(task.id);
    return intent ? { ...task, done: intent.done } : task;
  }) };
}

/** Coherent server lists cannot replace a project with an older task/status revision. */
export function mergeProjectCollection(current: NatoriProject[], incoming: NatoriProject[],
  startedRevisions?: ReadonlyMap<string, number>, pendingProjectIds?: ReadonlySet<string>): NatoriProject[] {
  const existing = new Map(current.map(project => [project.id, project]));
  const merged = incoming.map(project => {
    const previous = existing.get(project.id);
    return previous && (previous.mutationRevision ?? -1) > (project.mutationRevision ?? -1) ? previous : project;
  });
  if (startedRevisions) {
    const seen = new Set(incoming.map(project => project.id));
    for (const project of current) {
      if (!seen.has(project.id) && (pendingProjectIds?.has(project.id) || !startedRevisions.has(project.id) ||
          (project.mutationRevision ?? -1) > startedRevisions.get(project.id)!)) merged.push(project);
    }
  }
  return merged;
}

/** Client/demo preview only. It never establishes payment, delivery or receipt. */
export function previewProductionTasks(project: NatoriProject, tasks: NatoriProjectTask[]): NatoriProject {
  if (project.deletedAt || project.completedAt || project.deliveryAcceptedAt || project.deliveredMailAt ||
      !["rough", "lineart", "coloring", "waiting", "delivery_prep"].includes(project.status)) return project;
  const first = tasks.find(task => task.stage !== "material" && !task.done);
  const status = first?.stage === "lineart" ? "lineart" : first?.stage === "coloring" ? "coloring" :
    !first || first.stage === "finish" || first.stage === "delivery" ? "delivery_prep" : "rough";
  return { ...project, tasks, status, nextAction: first?.label ?? "納品ファイルを確認して納品通知" };
}
