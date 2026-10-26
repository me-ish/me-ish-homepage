import {NextResponse} from "next/server";
import {withNatoriManagement} from "@/features/natori/server/natoriManagementRoute";
import {resolveNatoriOwnerId} from "@/features/natori/server/natoriOwner";
import {caseSystemControlInputSchema} from "@/features/natori/lib/caseSystemControl";
import {checkCsrf} from "@/lib/auth/csrf";
import {readCaseSystemHold,readCaseSystemReview,controlCaseSystem} from "@/features/natori/server/caseSystemHold";
import {caseWorkspaceReadAvailable} from "@/features/natori/server/caseWorkspaceRead";
export const runtime="nodejs",dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store",Vary:"Cookie"};
// Administrative control only: production/target gates remain closed by default.
export const GET=withNatoriManagement("case-system.GET",false,async(request:Request)=>{
 if(!caseWorkspaceReadAvailable())return NextResponse.json({error:"not_configured"},{status:503,headers});
 try{const owner=await resolveNatoriOwnerId();if(new URL(request.url).searchParams.get("review")==="1")return NextResponse.json(await readCaseSystemReview(owner),{headers});const state=await readCaseSystemHold(owner);return NextResponse.json({paused:state.commandsHeld||state.sendersHeld||state.readOnly},{headers});}
 catch{return NextResponse.json({error:"state_unavailable",paused:true},{status:503,headers});}
});

export const POST=withNatoriManagement("case-system.POST",true,async(request:Request)=>{
 if(!caseWorkspaceReadAvailable())return NextResponse.json({error:"not_configured"},{status:503,headers});
 const csrf=checkCsrf(request);if(csrf)return csrf;
 const parsed=caseSystemControlInputSchema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"invalid_control"},{status:400,headers});
 try{const result=await controlCaseSystem(parsed.data);return NextResponse.json(result,{status:result.result==="saved"?200:409,headers});}
 catch{return NextResponse.json({error:"control_unconfirmed",priorRequestsMayComplete:true},{status:503,headers});}
});
