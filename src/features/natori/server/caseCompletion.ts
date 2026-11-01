import "server-only";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Json } from "@/types/supabase";
import { resolveNatoriManagementContext } from "./natoriOwner";
import { caseCompletionCommand } from "../lib/caseWork";

// Fixed RPC only. Owner/operator never come from browser input; the DB checks eligibility.
type Rpc=(name:"natori_case_complete_v1",args:Record<string,Json|undefined>)=>PromiseLike<{data:unknown;error:unknown}>;
const completionResult=z.object({result:z.enum(["applied","already-completed","not-eligible","not-expired","stale","conflict","inactive","invalid","not-found"])});
export async function commandCaseCompletion(raw:unknown){
 const input=caseCompletionCommand.parse(raw),context=await resolveNatoriManagementContext();
 const rpc=supabaseAdmin().rpc.bind(supabaseAdmin()) as unknown as Rpc;
 const {data,error}=await rpc("natori_case_complete_v1",{p_owner:context.ownerId,p_project:input.projectId,p_input:{
  requestId:input.requestId,revision:input.revision,kind:input.kind,note:input.note,
  ...(input.completedAt?{completedAt:input.completedAt}:{}),operator:context.operator,
 } as Json});
 if(error)throw Error("result_unconfirmed");
 return completionResult.parse(data);
}
