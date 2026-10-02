import {NextResponse} from "next/server";
import type {ConsultationOperationResult} from "./consultationOperationService";
export function consultationOperationResponse(result:ConsultationOperationResult){
 const status=result.kind==="committed"||result.kind==="prepared"||result.kind==="cancelled"||result.kind==="reserved"||result.kind==="verifying"?200
  :result.kind==="invalid"?400:result.kind==="not_found"?404:["busy","conflict","too_many","protected","notice_expired"].includes(result.kind)?409:503;
 return NextResponse.json({...result,ok:result.kind==="committed"||result.kind==="prepared"||result.kind==="cancelled",notificationDelivery:result.kind==="committed"?"pending":undefined},
 {status,headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
}

