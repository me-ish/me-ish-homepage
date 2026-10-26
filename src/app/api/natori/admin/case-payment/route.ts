import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCsrf } from "@/lib/auth/csrf";
import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
import { casePaymentEnabled,readCasePayment,commandCasePayment } from "@/features/natori/server/casePaymentWorkspace";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store","Vary":"Cookie"};
export const GET=withNatoriManagement("case-payment.GET",false,async(request:Request)=>{
 if(!casePaymentEnabled())return NextResponse.json({enabled:false},{headers});
 const p=new URL(request.url).searchParams,project=p.get("projectId"),op=p.get("operationId");
 if(!z.uuid().safeParse(project).success||(op!==null&&!z.uuid().safeParse(op).success))return NextResponse.json({error:"invalid_request"},{status:400,headers});
 try{const view=await readCasePayment(project!,op??undefined);return NextResponse.json({view},{status:view?200:404,headers});}catch{return NextResponse.json({error:"read_unavailable"},{status:503,headers});}
});
export const POST=withNatoriManagement("case-payment.POST",true,async(request:Request)=>{
 const denied=checkCsrf(request);if(denied)return denied;
 if(!casePaymentEnabled())return NextResponse.json({error:"not_configured"},{status:503,headers});
 try{const result=await commandCasePayment(await request.json());return NextResponse.json(result,{headers});}
 catch(error){return NextResponse.json({error:error instanceof z.ZodError?"invalid_request":"result_unconfirmed"},{status:error instanceof z.ZodError?400:503,headers});}
});
