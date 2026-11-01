import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCsrf } from "@/lib/auth/csrf";
import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
import { caseWorkspaceReadAvailable } from "@/features/natori/server/caseWorkspaceRead";
import { readCaseWork,commandCaseWork,commandCaseDelivery } from "@/features/natori/server/caseWork";
import { commandCaseCompletion } from "@/features/natori/server/caseCompletion";
export const runtime="nodejs",dynamic="force-dynamic";
const headers={"Cache-Control":"no-store","Vary":"Cookie"};
export const GET=withNatoriManagement("case-work.GET",false,async(request:Request)=>{
 if(!caseWorkspaceReadAvailable())return NextResponse.json({error:"unavailable"},{status:404,headers});
 const p=new URL(request.url).searchParams,id=p.get("projectId"),op=p.get("operationId");
 if(!z.uuid().safeParse(id).success||op!==null&&!z.uuid().safeParse(op).success)return NextResponse.json({error:"invalid"},{status:400,headers});
 try{const view=await readCaseWork(id!,op??undefined);return NextResponse.json({view},{status:view?200:404,headers});}catch{return NextResponse.json({error:"read_unavailable"},{status:503,headers});}
});
export const POST=withNatoriManagement("case-work.POST",true,async(request:Request)=>{
 const csrf=checkCsrf(request);if(csrf)return csrf;
 if(!caseWorkspaceReadAvailable())return NextResponse.json({error:"unavailable"},{status:404,headers});
 try{const raw:unknown=await request.json();const delivery=z.object({command:z.literal("delivery"),request:z.unknown()}).safeParse(raw);
  const complete=z.object({command:z.literal("complete")}).safeParse(raw).success;
  const result=delivery.success?await commandCaseDelivery(delivery.data.request):complete?await commandCaseCompletion(raw):await commandCaseWork(raw);return NextResponse.json(result,{headers});
 }catch(error){return NextResponse.json({error:error instanceof z.ZodError?"invalid":"result_unconfirmed"},{status:error instanceof z.ZodError?400:503,headers});}
});
