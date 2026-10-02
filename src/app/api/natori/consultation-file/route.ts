import {NextResponse} from "next/server";
import {checkCsrf} from "@/lib/auth/csrf";
import {withNatoriManagement} from "@/features/natori/server/natoriManagementRoute";
import {consultationOperation} from "@/features/natori/server/consultationOperationService";
import {finishConsultationUpload} from "@/features/natori/server/consultationFilesService";
import {consultationOperationResponse} from "@/features/natori/server/consultationOperationResponse";
export const runtime="nodejs",dynamic="force-dynamic";
export async function POST(request:Request){
 const csrf=checkCsrf(request);if(csrf)return csrf;
 const raw:unknown=await request.json().catch(()=>null);
 if(!raw||typeof raw!=="object")return NextResponse.json({error:"Invalid request"},{status:400});
 const actor="projectId" in raw&&typeof raw.projectId==="string"&&!("token" in raw)?{projectId:raw.projectId}
  :"token" in raw&&typeof raw.token==="string"&&!("projectId" in raw)?{token:raw.token}:null;
 if(!actor)return NextResponse.json({error:"Invalid request"},{status:400});
 const execute=async()=>{
  if("operation" in raw)return consultationOperationResponse(await consultationOperation(actor,raw.operation,"action" in raw&&raw.action==="finish"?"commit":"prepare"));
  if("action" in raw&&raw.action==="finish"&&"fileName" in raw&&typeof raw.fileName==="string"&&"mimeType" in raw&&typeof raw.mimeType==="string"&&"sizeBytes" in raw&&typeof raw.sizeBytes==="number"&&"path" in raw&&typeof raw.path==="string"){
   const replay=await finishConsultationUpload({...actor,fileName:raw.fileName,mimeType:raw.mimeType,sizeBytes:raw.sizeBytes,path:raw.path});
   if(replay.kind==="ok")return NextResponse.json({ok:true,messageId:replay.messageId},{headers:{"Cache-Control":"no-store"}});
  }
  return NextResponse.json({error:"ページを再読み込みしてから送信してください",code:"client_update_required"},{status:426});
 };
 return "projectId" in actor?withNatoriManagement("consultation-file.POST",true,execute)():execute();
}
