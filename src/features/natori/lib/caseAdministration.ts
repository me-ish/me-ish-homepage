import { z } from "zod";
import {
  taskProjectionSchema,
  type NatoriTaskProjection,
} from "./taskProjection";
import { readNatoriProjectType } from "./projectReadModel";
import type { NatoriProject, NatoriDeliveryPlan } from "../types/projects";
import { normalizeNatoriReferenceUrl } from "./referenceLinks";

const money = z.number().int().min(0).max(2147483647),
  date = z.iso.date().nullable();
export const caseBasicDetails = z.strictObject({
  title: z.string().trim().min(1).max(500),
  client_name: z.string().trim().min(1).max(500),
  amount: money.nullable(),
  delivery_plan: z.enum(["normal", "rush_14_days", "rush_7_days"]),
  start_date: date,
  due_date: date,
  note: z.string().max(10000).nullable(),
});
export const caseRegistration = z.strictObject({
  mode: z.enum(["manual", "external"]),
  title: z.string().trim().min(1).max(500),
  clientName: z.string().trim().min(1).max(500),
  clientEmail: z.union([z.email(), z.literal("")]),
  type: z.enum(["icon", "sd", "standing", "illustration"]),
  status: z.enum(["inquiry", "estimating", "quoted", "awaiting_payment"]),
  amount: money,
  deliveryPlan: z.enum(["normal", "rush_14_days", "rush_7_days"]),
  startDate: z.iso.date(),
  dueDate: z.iso.date(),
  note: z.string().max(10000),
});
export const caseAdminAction = z.discriminatedUnion("command", [
  z.strictObject({command:z.literal("intake-memo"),text:z.string().trim().max(120)}),
  z.strictObject({command:z.literal("reference-link"),mode:z.enum(["add","edit","remove"]),linkId:z.uuid().nullable(),
    url:z.string().max(2048),label:z.string().trim().max(100).nullable()}).superRefine((v,c)=>{
      if((v.mode!=="add"&&!v.linkId)||(v.mode==="add"&&v.linkId!==null)||(v.mode!=="remove"&&!normalizeNatoriReferenceUrl(v.url)))
        c.addIssue({code:"custom",message:"reference_link_invalid"});
    }),
  z.strictObject({ command: z.literal("create"), data: caseRegistration }),
  z.strictObject({ command: z.literal("details"), patch: caseBasicDetails }),
  z.strictObject({
    command: z.enum(["manual-payment", "reopen", "archive", "restore"]),
  }),
  z.strictObject({
    command: z.literal("close"),
    reason: z.string().trim().min(1).max(2000),
  }),
  z.strictObject({
    command: z.literal("retry-notice"),
    notificationId: z.uuid(),
    previewHash: z.string().regex(/^[a-f0-9]{64}$/),
  }),
]);
export const caseAdminRequest = z
  .strictObject({
    operationId: z.uuid(),
    projectId: z.uuid().nullable(),
    revision: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    action: caseAdminAction,
  })
  .superRefine((v, c) => {
    if (
      v.action.command === "create"
        ? v.projectId !== null || v.revision !== null
        : !v.projectId || !v.revision
    )
      c.addIssue({ code: "custom", message: "confirmation_scope_invalid" });
  });
export type CaseAdminRequest = z.infer<typeof caseAdminRequest>;
export const caseAdminReceipt = z.object({
  operationId: z.uuid().optional(),
  projectId: z.uuid(),
  command: z.string().optional(),
  result: z.string(),
  notificationId: z.uuid().nullish(),
  replayed: z.boolean().optional(),
});
export const caseAdminView = z.object({
  selectedNotice:z.object({id:z.uuid(),latestId:z.uuid(),isLatest:z.boolean()}).optional(),
  project: taskProjectionSchema,
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  complete: z.boolean(),
  acceptance: z.object({
    at: z.string().nullable(),
    amount: z.number().nullable(),
  }),
  quote: z
    .object({
      id: z.uuid(),
      version: z.number().int(),
      amount: z.number(),
      acceptedAt: z.string().nullable(),
      to: z.string(),
      subject: z.string(),
      body: z.string(),
      expiresAt: z.string(),
    })
    .nullable(),
  notices: z
    .array(
      z.object({
        id: z.uuid(),
        purpose: z.string(),
        status: z.string(),
        attempt_no: z.number().int(),
        quote_id: z.uuid().nullable(),
        deadline: z.string().nullable(),
        created_at: z.string(),
        sent_at: z.string().nullable(),
        retry_candidate: z.boolean(),
        preview: z
          .object({
            to: z.array(z.string()),
            from: z.string(),
            replyTo: z.string().optional(),
            bcc: z.array(z.string()).optional(),
            subject: z.string(),
            body: z.string(),
            hash: z.string(),
          })
          .optional(),
      }),
    )
    .max(200),
});
export type CaseAdminView = z.infer<typeof caseAdminView>;
export function caseProject(p: NatoriTaskProjection): NatoriProject {
  return {
    ...p,
    type: readNatoriProjectType(p.type),
    deliveryPlan: p.deliveryPlan as NatoriDeliveryPlan,
    priority: undefined,
    clientEmail: p.clientEmail ?? undefined,
    startDate: p.startDate ?? undefined,
    note: p.note ?? undefined,
    requestData: p.requestData ?? undefined,
    paymentConfirmedAt: p.paymentConfirmedAt ?? undefined,
    paidAt: p.paidAt ?? undefined,
    paidAmount: p.paidAmount ?? undefined,
    completedAt: p.completedAt ?? undefined,
    deliveryAcceptedAt: p.deliveryAcceptedAt ?? undefined,
    deliveredMailAt: p.deliveredMailAt ?? undefined,
    deletedAt: p.deletedAt ?? undefined,
    tasks: p.tasks
      .filter((t) => t.stage !== "material")
      .map((t) => ({ ...t, estimatedHours: t.estimatedHours ?? undefined })),
  };
}
export const caseAdminLabels = {
  "intake-memo":"メモを保存",
  "reference-link":"参考リンクを保存",
  create: "案件を登録",
  details: "案件の情報を保存",
  "manual-payment": "振込などの入金を記録",
  close: "この相談を見送る",
  reopen: "相談を再開する",
  archive: "しまっておく",
  restore: "しまった案件を戻す",
  "retry-notice": "メールを送り直す",
};
