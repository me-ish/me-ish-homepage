import {NextResponse} from "next/server";
import {checkCsrf} from "@/lib/auth/csrf";
import {getClientConsultation} from "@/features/natori/server/consultationService";
import {consultationOperation} from "@/features/natori/server/consultationOperationService";
import {consultationOperationResponse} from "@/features/natori/server/consultationOperationResponse";
export const runtime="nodejs",dynamic="force-dynamic";
type Context={params:Promise<{token:string}>};
export async function GET(_request:Request,context:Context){
 const {token}=await context.params,result=await getClientConsultation(token);
 return result?NextResponse.json(result,{headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}}):NextResponse.json({error:"Not found"},{status:404});
}
export async function POST(request:Request,context:Context){
 const csrf=checkCsrf(request);if(csrf)return csrf;
 const {token}=await context.params,raw:unknown=await request.json().catch(()=>null);
 if(!raw||typeof raw!=="object"||!("operation" in raw))return NextResponse.json({error:"ページを再読み込みしてから送信してください",code:"client_update_required"},{status:426});
 const action="action" in raw&&raw.action==="lookup"?"lookup":"action" in raw&&raw.action==="cancel"?"cancel":"commit";
 return consultationOperationResponse(await consultationOperation({token},raw.operation,action));
}
