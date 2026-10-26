import {NextResponse} from "next/server";
import {withNatoriManagement} from "@/features/natori/server/natoriManagementRoute";
import {caseDashboardSystemMode} from "@/features/natori/server/caseDashboardPreview";
import {readCaseNoticeIndex,readCasePersonalEvents} from "@/features/natori/server/caseEntryIndex";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store, max-age=0",Vary:"Cookie"};
export const GET=withNatoriManagement("case-entry-index.GET",false,async(request:Request)=>{
 if((await caseDashboardSystemMode())==="off")return NextResponse.json({error:"not_available"},{status:404,headers});
 const kind=new URL(request.url).searchParams.get("kind");
 if(kind!=="events"&&kind!=="notices")return NextResponse.json({error:"invalid_kind"},{status:400,headers});
 try{return NextResponse.json({contract:"natori-case-entry-index-v1",kind,...(kind==="events"?{items:await readCasePersonalEvents()}:await readCaseNoticeIndex())},{headers});}
 catch{return NextResponse.json({error:"case_entry_unavailable"},{status:503,headers});}
});
