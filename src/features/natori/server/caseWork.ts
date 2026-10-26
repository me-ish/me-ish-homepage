import "server-only";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Json } from "@/types/supabase";
import { resolveNatoriManagementContext } from "./natoriOwner";
import { caseWorkView,caseWorkCommand,caseDeliveryRequest } from "../lib/caseWork";
import { DELIVERY_VALID_DAYS } from "../lib/orderMail";
import { issueReadyDelivery } from "./deliveryReleaseService";

// Fixed RPCs only. Owner/operator never come from browser input.
type Rpc=(name:"natori_case_work_read_v1"|"natori_case_work_command_v1",args:Record<string,Json|undefined>,options?:{get:true})=>PromiseLike<{data:unknown;error:unknown}>;
export async function readCaseWork(projectId:string,operationId?:string){
 const {ownerId}=await resolveNatoriManagementContext();
 const rpc=supabaseAdmin().rpc.bind(supabaseAdmin()) as unknown as Rpc;
 const {data,error}=await rpc("natori_case_work_read_v1",{p_owner:ownerId,p_project:projectId,p_operation:operationId},{get:true});
 if(error)throw Error("read_unavailable");if(!data)return null;
 const view=caseWorkView.parse(data);if(view.project.id!==projectId||view.operation&&view.operation.id!==operationId)throw Error("scope_mismatch");return view;
}
export async function commandCaseWork(raw:unknown){
 const input=caseWorkCommand.parse(raw),context=await resolveNatoriManagementContext();
 const rpc=supabaseAdmin().rpc.bind(supabaseAdmin()) as unknown as Rpc;
 const {data,error}=await rpc("natori_case_work_command_v1",{p_owner:context.ownerId,p_project:input.projectId,p_command:input.command,p_input:{...input,operator:context.operator} as Json});
 if(error)throw Error("result_unconfirmed");return z.object({result:z.string()}).parse(data);
}
export async function commandCaseDelivery(raw:unknown){
 const input=caseDeliveryRequest.parse(raw),view=await readCaseWork(input.projectId,input.operationId);
 if(!view)return {kind:"not-found"};
 // A prior operation is only queried here. Dispatch/retry requires a separate explicit action.
 if(view.operation)return {kind:"recorded",operation:view.operation};
 if(view.revision!==input.revision)return {kind:"confirmation-stale"};
 if(view.outboundBlocked)return {kind:"notice-pending"};
 // Match the existing UI's extension entry: extend an expired issued delivery only.
 if(input.extension&&(!view.release||Date.parse(view.release.expiresAt)>Date.now()))return {kind:"invalid-expiry"};
 if(JSON.stringify(input.files)!==JSON.stringify(view.files)||view.files.some(f=>f.state!=="ready"||!f.version||!f.verifiedAt)
  ||JSON.stringify(input.fileIds)!==JSON.stringify(view.files.map(f=>f.id)))return {kind:"confirmation-stale"};
 const age=Date.now()-Date.parse(input.preparedAt);
 const days=input.extension?.days??DELIVERY_VALID_DAYS;
 const expected=input.extension||!view.release?Date.parse(input.preparedAt)+days*86400000:Date.parse(view.release.expiresAt);
 if(age<0||age>60000||Date.parse(input.expiresAt)!==expected)return {kind:"confirmation-stale"};
 return issueReadyDelivery({...input,workspace:{revision:input.revision,expiresAt:input.expiresAt}});
}
