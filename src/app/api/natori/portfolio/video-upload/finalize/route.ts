import {NextResponse} from "next/server";
import {withNatoriManagement} from "@/features/natori/server/natoriManagementRoute";
import {checkCsrf} from "@/lib/auth/csrf";
import {finalizePrivatePortfolioVideo} from "@/features/natori/server/portfolioAssetsService";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const POST=withNatoriManagement("portfolio-video.finalize",true,async (request:Request)=>{
  const csrf=checkCsrf(request);if (csrf) return csrf;
  const body=await request.json().catch(()=>null) as {assetId?:unknown}|null;
  if (typeof body?.assetId!=="string" || !/^[0-9a-f-]{36}$/i.test(body.assetId)) return NextResponse.json({error:"Invalid upload"},{status:400});
  const ok=await finalizePrivatePortfolioVideo(body.assetId);
  return NextResponse.json(ok ? {ok:true} : {error:"Upload could not be verified"},{status:ok ? 200 : 400,headers:{"Cache-Control":"private, no-store"}});
});
