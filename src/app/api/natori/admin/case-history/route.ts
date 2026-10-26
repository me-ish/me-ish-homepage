import { NextResponse } from "next/server";
import { z } from "zod";
import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
import { caseDashboardSystemMode } from "@/features/natori/server/caseDashboardPreview";
import { readCaseHistory } from "@/features/natori/server/caseHistoryRead";
export const runtime="nodejs",dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store",Vary:"Cookie"};
export const GET=withNatoriManagement("case-history.GET",false,async(request:Request)=>{
 if((await caseDashboardSystemMode())==="off")return NextResponse.json({error:"unavailable"},{status:404,headers});
 const q=new URL(request.url).searchParams,id=q.get("projectId"),offset=Number(q.get("offset")??0),revision=q.get("revision");
 if(!z.uuid().safeParse(id).success||!Number.isSafeInteger(offset)||offset<0||offset>2147483647||(revision!==null&&!/^[a-f0-9]{32}$/.test(revision))||(offset>0&&!revision))return NextResponse.json({error:"invalid"},{status:400,headers});
 try{const result=await readCaseHistory(id!,offset,revision);if(result.state!=="ready")return NextResponse.json({error:result.state},{status:result.state==="not_found"?404:409,headers});
 return NextResponse.json({contract:"natori-case-history-v1",view:result.view},{headers});
 }catch{return NextResponse.json({error:"unavailable"},{status:503,headers});}
});
