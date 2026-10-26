import { z } from "zod";
export const casePaymentPreviewSchema=z.object({projectId:z.uuid(),projectTitle:z.string(),operationId:z.uuid(),kind:z.enum(["initial","resend","retry","resume"]),quoteVersion:z.number().int(),amount:z.number().int(),deadline:z.string().nullable(),deadlinePolicy:z.literal("sent_plus_7_days").optional(),to:z.array(z.string()),from:z.string(),replyTo:z.string(),bcc:z.array(z.string()),subject:z.string(),text:z.string(),linkPending:z.boolean(),validUntil:z.string(),token:z.string()});
export type CasePaymentPreview=z.infer<typeof casePaymentPreviewSchema>;
export const casePaymentViewSchema=z.object({enabled:z.boolean(),projectId:z.uuid(),phase:z.enum(["prepare","sent","failed","unknown","processing","blocked","paid"]),reason:z.string(),quoteVersion:z.number().nullable(),amount:z.number().nullable(),deadline:z.string().nullable(),deadlinePolicy:z.literal("sent_plus_7_days").optional(),recipient:z.string().nullable(),sentCount:z.number(),canPrepare:z.boolean(),canRetry:z.boolean(),canResume:z.boolean(),operationId:z.string().nullable(),operationState:z.string().nullable(),receipt:z.string().nullable(),jobs:z.array(z.object({id:z.uuid(),status:z.string(),attempt:z.number(),sentAt:z.string().nullable()}))});
export type CasePaymentView=z.infer<typeof casePaymentViewSchema>;
export const casePaymentCommandSchema=z.discriminatedUnion("action",[
 z.object({action:z.literal("prepare"),projectId:z.uuid(),deadline:z.iso.datetime().optional(),retry:z.boolean().optional(),resume:z.boolean().optional()}).strict(),
 z.object({action:z.literal("confirm"),projectId:z.uuid(),operationId:z.uuid(),token:z.string().min(1).max(50000)}).strict(),
]);
