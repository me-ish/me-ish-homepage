import { z } from "zod";
import { taskProjectionSchema } from "./taskProjection";
import { DELIVERY_EXTENSION_DAYS } from "./orderMail";

export const caseWorkKind = z.enum(["origin", "revision_open", "revision_handled", "manual_agreement", "manual_delivery", "manual_receipt", "manual_completion"]);
export const caseWorkData = z.object({
 note: z.string().trim().min(1).max(2000),
 origin: z.enum(["internal", "external", "manual", "historical", "unknown"]).optional(),
 messageId: z.uuid().optional(), roughId: z.uuid().optional(), requestId: z.uuid().optional(),
 responseMessageId: z.uuid().optional(), nextRoughId: z.uuid().optional(),
 target: z.string().trim().min(1).max(500).optional(), occurredAt: z.iso.datetime({offset:true}).optional(),
});
export const caseWorkRecord = z.object({ id:z.uuid(),kind:caseWorkKind,data:caseWorkData,
 operator:z.object({kind:z.enum(["auth-user","shared-key"]),userId:z.uuid().nullable()}),created_at:z.string() });
export const caseWorkFile=z.object({id:z.uuid(),fileName:z.string(),sizeBytes:z.number().int().positive(),version:z.string().nullable(),verifiedAt:z.string().nullable(),state:z.string()});
export const caseWorkView = z.object({
 project:taskProjectionSchema, revision:z.string().regex(/^[a-f0-9]{64}$/),complete:z.literal(true),
 records:z.array(caseWorkRecord).max(200),
 files:z.array(caseWorkFile).max(10),
 messages:z.array(z.object({id:z.uuid(),sender:z.enum(["staff","client"]),body:z.string(),created_at:z.string(),rough_id:z.uuid().nullable(),client_ok_at:z.string().nullable()})).max(200),
 release:z.object({id:z.uuid(),expiresAt:z.string(),acceptedAt:z.string().nullable(),publishedAt:z.string()}).nullable(),
 operation:z.object({id:z.uuid(),releaseId:z.uuid(),notificationId:z.uuid(),status:z.string()}).nullable(),
 outboundBlocked:z.boolean(),
});
export type CaseWorkView=z.infer<typeof caseWorkView>;
export const caseWorkCommand=z.discriminatedUnion("command",[
 z.object({command:z.literal("confirm_type"),projectId:z.uuid(),revision:z.string(),projectType:z.enum(["icon","sd","standing","illustration"])}),
 z.object({command:z.literal("record"),projectId:z.uuid(),revision:z.string(),id:z.uuid(),kind:caseWorkKind,data:caseWorkData}).superRefine((r,ctx)=>{
  const required=r.kind==="origin"?["origin"]:r.kind==="revision_open"?["messageId","roughId"]:r.kind==="revision_handled"?["requestId","responseMessageId"]:["target","occurredAt"];
  for(const key of required)if(!r.data[key as keyof typeof r.data])ctx.addIssue({code:"custom",path:["data",key],message:"required_for_kind"});
 }),
 z.object({command:z.literal("metadata"),projectId:z.uuid(),revision:z.string(),data:z.strictObject({note:z.string().max(10000).nullable(),dueDate:z.iso.date().nullable(),startDate:z.iso.date().nullable()})}),
 z.object({command:z.literal("task"),projectId:z.uuid(),revision:z.string(),taskKey:z.string().min(1).max(200),done:z.boolean()}),
]);
export const caseDeliveryRequest=z.object({
 projectId:z.uuid(),operationId:z.uuid(),revision:z.string().regex(/^[a-f0-9]{64}$/),
 to:z.email(),subject:z.string().trim().min(1).max(200).refine(v=>!/[\r\n]/.test(v)),body:z.string().min(1).max(20000),
 fileIds:z.array(z.uuid()).min(1).max(10).refine(v=>new Set(v).size===v.length),
 files:z.array(caseWorkFile).min(1).max(10),
 preparedAt:z.iso.datetime(),expiresAt:z.iso.datetime(),
 extension:z.object({days:z.number().refine(v=>(DELIVERY_EXTENSION_DAYS as readonly number[]).includes(v)),reason:z.string().trim().min(1).max(200)}).optional(),
});
export type CaseDeliveryRequest=z.infer<typeof caseDeliveryRequest>;
export function openCaseRevisions(records:CaseWorkView["records"]){
 const handled=new Set(records.filter(r=>r.kind==="revision_handled").map(r=>r.data.requestId));
 return records.filter(r=>r.kind==="revision_open"&&!handled.has(r.id));
}
export const caseWorkLabels:Record<z.infer<typeof caseWorkKind>,string>={origin:"どこで受けた案件か",revision_open:"修正の依頼",revision_handled:"修正に対応した",manual_agreement:"サイトの外で決まった",manual_delivery:"サイトの外で納品した",manual_receipt:"サイトの外で受け取ってもらった",manual_completion:"完了にした"};
export const caseOriginLabels={internal:"このサイト",external:"サイトの外（SNS・メールなど）",manual:"あなたが登録した案件",historical:"過去の実績",unknown:"分からない"};
export const caseWorkNoticeLabel=(status:string)=>({pending:"送信待ち",sending:"送信中",sent:"送信しました",failed:"送れませんでした",unknown:"送れたか分かりません"}[status]??"送れたか分かりません");
