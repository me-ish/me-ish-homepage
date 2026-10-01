import { z } from "zod";
import {PAYMENT_LINK_PLACEHOLDER} from "./orderMail";
const uuid=z.uuid();
export const paymentLinkRequestSchema=z.object({
 projectId:uuid,operationId:uuid,action:z.enum(["issue","renotify","extend","reissue","adopt"]),
 revision:z.number().int().positive().optional(),deadline:z.iso.datetime().optional(),confirmed:z.boolean().optional(),
 to:z.email().max(254).optional(),subject:z.string().min(1).max(200).optional(),body:z.string().min(1).max(8000).optional(),
}).strict().superRefine((v,ctx)=>{
 if(["issue","reissue","renotify"].includes(v.action)&&(!v.to||!v.subject||!v.body))ctx.addIssue({code:"custom",message:"mail_required"});
 if(["issue","reissue","extend"].includes(v.action)&&!v.deadline)ctx.addIssue({code:"custom",message:"deadline_required"});
 if(["renotify","extend"].includes(v.action)&&!v.revision)ctx.addIssue({code:"custom",message:"revision_required"});
 if(["reissue","extend","adopt"].includes(v.action)&&!v.confirmed)ctx.addIssue({code:"custom",message:"confirmation_required"});
});
export type PaymentLinkRequest=z.infer<typeof paymentLinkRequestSchema>;
export const paymentLinkStateSchema=z.object({result:z.literal("ok"),state:z.string(),attemptId:uuid.nullable(),generation:z.number().nullable(),revision:z.number().nullable(),
 deadline:z.string().nullable(),url:z.string().nullable(),confirmedAt:z.string().nullable(),terminal:z.boolean(),canIssue:z.boolean(),amount:z.number().nullable(),notificationStatus:z.string().nullable()});
export type PaymentLinkState=z.infer<typeof paymentLinkStateSchema>;

export function buildGenerationPaymentMail(clientName:string,title:string,amount:number){
 return {subject:`お支払いのご案内 / ${title}`,body:[`${clientName} 様`,"","ご依頼の確定ありがとうございます。",`ご依頼内容: ${title}`,`お支払い金額: ${amount.toLocaleString("ja-JP")}円`,"","お支払いリンク:",PAYMENT_LINK_PLACEHOLDER,"","支払期限はこの案内の末尾に記載します。再通知による自動延長はありません。","ご不明な点はこのメールへの返信でお問い合わせください。"].join("\n")};
}
