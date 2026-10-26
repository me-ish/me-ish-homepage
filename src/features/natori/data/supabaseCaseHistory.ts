import { caseHistoryView, assertHistoryPage, type CaseHistoryView } from "../lib/caseHistory";
import { CaseWorkspaceLoadError } from "../types/caseWorkspaceLoad";
export class CaseHistoryChangedError extends Error {}
export async function loadCaseHistory(projectId:string,offset:number,revision:string|null,signal:AbortSignal):Promise<CaseHistoryView>{
 const q=new URLSearchParams({projectId,offset:String(offset)});if(revision)q.set("revision",revision);
 const response=await fetch(`/api/natori/admin/case-history?${q}`,{method:"GET",credentials:"same-origin",cache:"no-store",signal});
 if(response.status===401)throw new CaseWorkspaceLoadError("unauthorized");
 if(response.status===404)throw new CaseWorkspaceLoadError("not_found");
 if(response.status===409)throw new CaseHistoryChangedError("changed");
 const result=await response.json().catch(()=>null);
 if(result?.code==="natori_owner_unavailable")throw new CaseWorkspaceLoadError("scope_unavailable");
 if(!response.ok||result?.contract!=="natori-case-history-v1")throw new CaseWorkspaceLoadError("unavailable");
 const page=caseHistoryView.parse(result.view);assertHistoryPage(page,projectId,offset,revision);
 return page;
}
