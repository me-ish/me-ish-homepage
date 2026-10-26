import { CSRF_HEADERS } from "@/lib/auth/csrf";
import { casePaymentViewSchema,casePaymentPreviewSchema,type CasePaymentView,type CasePaymentPreview } from "../lib/casePaymentWorkspace";
export class CasePaymentError extends Error{constructor(public readonly unauthorized=false){super(unauthorized?"ログインを確認してください。確認内容を閉じました。":"結果を確認できません。送信し直さず、結果を照会してください。");}}
export async function readCasePaymentView(project:string,operation?:string,signal?:AbortSignal):Promise<CasePaymentView|null>{
 const r=await fetch(`/api/natori/admin/case-payment?${new URLSearchParams({projectId:project,...(operation?{operationId:operation}:{})})}`,{cache:"no-store",signal});
 if(!r.ok)throw new CasePaymentError(r.status===401);const data:unknown=await r.json();
 if(data&&typeof data==="object"&&"enabled" in data&&data.enabled===false)return null;
 return casePaymentViewSchema.parse((data as {view:unknown}).view);
}
export async function postCasePayment(command:unknown):Promise<{result:string;view?:CasePaymentView;preview?:CasePaymentPreview}>{
 const r=await fetch("/api/natori/admin/case-payment",{method:"POST",headers:{...CSRF_HEADERS,"Content-Type":"application/json"},body:JSON.stringify(command),cache:"no-store"});
 if(!r.ok)throw new CasePaymentError(r.status===401);const d=await r.json();
 return {result:String(d.result),...(d.view?{view:casePaymentViewSchema.parse(d.view)}:{}),...(d.preview?{preview:casePaymentPreviewSchema.parse(d.preview)}:{})};
}
