import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
import { paymentLinkIntegrityEnabled, getPaymentLinkState, getRejectedPaymentLinkOperation, executePaymentLinkOperation } from "@/features/natori/server/paymentLinkService";
import { z } from "zod";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const GET=withNatoriManagement("payment-link.GET",false,async(request:Request)=>{
 if(!paymentLinkIntegrityEnabled())return NextResponse.json({enabled:false},{headers:{"Cache-Control":"no-store"}});
 const params=new URL(request.url).searchParams,projectId=params.get("projectId");if(!z.uuid().safeParse(projectId).success)return NextResponse.json({error:"invalid_request"},{status:400});
 const operationId=params.get("operationId");
 if(operationId!==null&&!z.uuid().safeParse(operationId).success)return NextResponse.json({error:"invalid_request"},{status:400});
 try{return NextResponse.json({enabled:true,state:await getPaymentLinkState(projectId!),...(operationId?await getRejectedPaymentLinkOperation(projectId!,operationId):{})},{headers:{"Cache-Control":"no-store"}});}
 catch{return NextResponse.json({error:"支払状態を確認できません。再読込してください。"},{status:503});}
});
export const POST=withNatoriManagement("payment-link.POST",true,async(request:Request)=>{
 const denied=checkCsrf(request);if(denied)return denied;
 if(!paymentLinkIntegrityEnabled())return NextResponse.json({error:"not_configured"},{status:503});
 const done=await executePaymentLinkOperation(await request.json().catch(()=>null));
 const code=done.result;
 const status=code==="completed"?200:code==="invalid_request"?400:["busy","retry_same_operation","temporarily_unavailable","not_configured"].includes(code)?503:409;
 const messages:Record<string,string>={busy:"処理中です。同じ操作で少し待って再試行してください。",retry_same_operation:"結果を確認できません。同じ操作で再試行してください。",
  conflict:"前回と操作内容・期限の版が異なります。現状を再読込して確認してください。",stop_required:"旧リンクの停止確認が必要です。再発行はまだできません。",
  legacy_review:"既存リンクの照合が必要です。URLや期限は変更していません。",payment_review:"入金の照合が必要です。新しいリンクは作成していません。",
  needs_review:"リンクの照合が必要です。成功として案内していません。",invalid_deadline:"期限を確認してください。延長には現在より後の日時と確認が必要です。",
  invalid_state:"現在の案件・支払状態ではこの操作を行えません。再読込してください。"};
 return NextResponse.json({...done,...(status===200?{ok:true}:{ok:false,error:messages[code]??"処理結果を確認できません。再読込し、同じ操作で再試行してください。"})},
  {status,headers:{"Cache-Control":"no-store",...(status===503?{"Retry-After":"5"}:{})}});
});
