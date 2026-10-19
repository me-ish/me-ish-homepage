import {NextResponse} from "next/server";
import {z} from "zod";
import {withNatoriManagement} from "@/features/natori/server/natoriManagementRoute";
import {getPaymentStopStatus} from "@/features/natori/server/paymentStopManagementService";
import {retryPaymentStop} from "@/features/natori/server/paymentLinkService";
import {checkCsrf} from "@/lib/auth/csrf";
import {checkRateLimit,getIpFromRequest,rateLimitExceeded} from "@/lib/rateLimit";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const headers={"Cache-Control":"no-store"};
export const GET=withNatoriManagement("payment-stops.GET",false,async()=>{
 try{return NextResponse.json(await getPaymentStopStatus(),{headers});}
 catch{return NextResponse.json({error:"payment_stop_read_failed"},{status:503,headers});}
});
export const POST=withNatoriManagement("payment-stops.POST",true,async(request:Request)=>{
 const csrf=checkCsrf(request);if(csrf)return csrf;
 const rate=await checkRateLimit(`natori-payment-stop-retry:${getIpFromRequest(request)}`,{limit:10,windowMs:600000});
 if(!rate.allowed)return rateLimitExceeded(rate.retryAfterMs);
 const parsed=z.object({projectId:z.uuid(),jobId:z.uuid()}).strict().safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"invalid_request"},{status:400,headers});
 const done=await retryPaymentStop(parsed.data.projectId,parsed.data.jobId);
 const status=done.result==="completed"?200:done.result==="not_found"?404:["not_configured","unconfirmed","busy"].includes(done.result)?503:409;
 return NextResponse.json({ok:status===200,...done},{status,headers:{...headers,...(status===503?{"Retry-After":"5"}:{})}});
});
