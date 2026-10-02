import {withNatoriManagement} from "@/features/natori/server/natoriManagementRoute";
import {NextResponse} from "next/server";
import {checkCsrf} from "@/lib/auth/csrf";
import {canUseNatoriManagement} from "@/features/natori/server/requireNatoriAdmin";
import {getStaffConsultation,retryStaffConsultationNotification} from "@/features/natori/server/consultationService";
import {consultationOperation} from "@/features/natori/server/consultationOperationService";
import {consultationOperationResponse} from "@/features/natori/server/consultationOperationResponse";
export const runtime="nodejs",dynamic="force-dynamic";
export const GET=withNatoriManagement("consultation.GET",false,async(request:Request)=>{
 if(!await canUseNatoriManagement())return NextResponse.json({error:"Unauthorized"},{status:401});
 const result=await getStaffConsultation(new URL(request.url).searchParams.get("projectId")??"");
 return result?NextResponse.json({messages:result.messages,closed:result.project.status==="closed"||Boolean(result.project.deleted_at)},{headers:{"Cache-Control":"no-store"}}):NextResponse.json({error:"Not found"},{status:404});
});
export const POST=withNatoriManagement("consultation.POST",true,async(request:Request)=>{
 if(!await canUseNatoriManagement())return NextResponse.json({error:"Unauthorized"},{status:401});
 const csrf=checkCsrf(request);if(csrf)return csrf;
 const raw:unknown=await request.json().catch(()=>null);
 if(!raw||typeof raw!=="object"||!("projectId" in raw)||typeof raw.projectId!=="string")return NextResponse.json({error:"Invalid request"},{status:400});
 if("retryMessageId" in raw&&typeof raw.retryMessageId==="string"){
  const sent=await retryStaffConsultationNotification(raw.projectId,raw.retryMessageId);
  return NextResponse.json({ok:sent==="ok",notificationFailed:sent!=="ok"},{status:sent==="ok"?200:409});
 }
 if(!("operation" in raw))return NextResponse.json({error:"ページを再読み込みしてから送信してください",code:"client_update_required"},{status:426});
 const action="action" in raw&&raw.action==="lookup"?"lookup":"action" in raw&&raw.action==="cancel"?"cancel":"commit";
 return consultationOperationResponse(await consultationOperation({projectId:raw.projectId},raw.operation,action));
});
