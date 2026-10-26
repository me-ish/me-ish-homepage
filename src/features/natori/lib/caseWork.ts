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
export const caseWorkLabels:Record<z.infer<typeof caseWorkKind>,string>={origin:"案件の由来",revision_open:"修正対応待ち",revision_handled:"担当の対応記録（依頼者OKとは別）",manual_agreement:"外部での合意・担当記録",manual_delivery:"外部での送付・担当記録",manual_receipt:"外部での受領・担当記録",manual_completion:"手動完了の担当記録（サイト受取とは別）"};
export const caseOriginLabels={internal:"サイトで受付",external:"外部で受けた相談",manual:"担当が登録した稼働案件",historical:"過去の実績",unknown:"由来未確認"};
export const caseWorkNoticeLabel=(status:string)=>({pending:"送信待ち",sending:"処理中（結果未確認）",sent:"送信サービス受付済み（到達・既読とは別の記録）",failed:"確定した送信失敗",unknown:"結果不明・要確認"}[status]??"結果未確認");
