import "server-only";
import { caseWorkspaceReadAvailable } from "./caseWorkspaceRead";
import {readCaseSystemHold} from "./caseSystemHold";
import {resolveTrustedNatoriOwnerId} from "./trustedNatoriOwner";

/** Explicit entry opt-in; availability also requires a validated deployment target. */
export function caseDashboardPreviewAvailable(): boolean {
  return caseDashboardPreviewMode()!=="off";
}
export function caseDashboardPreviewMode(): "off"|"interactive"|"read-only" {
  const flag=process.env.NATORI_CASE_DASHBOARD_PREVIEW_ENABLED;
  if((flag!=="1"&&flag!=="read-only")||!caseWorkspaceReadAvailable())return "off";
  return flag==="read-only"?"read-only":"interactive";
}

/** Persisted rollback survives removing the entry flag; release target remains mandatory. */
export async function caseDashboardSystemMode():Promise<"off"|"interactive"|"read-only">{
 const configured=caseDashboardPreviewMode();
 if(!caseWorkspaceReadAvailable())return "off";
 const owner=resolveTrustedNatoriOwnerId();
 if(owner.kind!=="ok")return "read-only";
 try{
  const state=await readCaseSystemHold(owner.ownerId);
  return state.commandsHeld||state.sendersHeld||state.readOnly||(state.armed&&configured==="off")?"read-only":configured;
 }catch{return "read-only";}
}
