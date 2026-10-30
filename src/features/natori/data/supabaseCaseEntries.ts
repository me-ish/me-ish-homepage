"use client";
import type {CaseNoticeIndex,CasePersonalEvent,CaseTalkPreview} from "../types/caseEntryIndex";
import {CaseWorkspaceLoadError} from "../types/caseWorkspaceLoad";
async function read(kind:"events"|"notices"|"talks",signal:AbortSignal){
 const response=await fetch(`/api/natori/admin/case-workspace/entries?kind=${kind}`,{method:"GET",credentials:"same-origin",cache:"no-store",signal});
 const value=await response.json().catch(()=>null);
 if(response.status===401)throw new CaseWorkspaceLoadError("unauthorized");
 if(value?.code==="natori_owner_unavailable")throw new CaseWorkspaceLoadError("scope_unavailable");
 if(!response.ok||value?.contract!=="natori-case-entry-index-v1"||value.kind!==kind||!Array.isArray(value.items))throw new CaseWorkspaceLoadError("unavailable");
 return value;
}
export async function loadCasePersonalEvents(signal:AbortSignal):Promise<readonly CasePersonalEvent[]>{return (await read("events",signal)).items;}
export async function loadCaseNoticeIndex(signal:AbortSignal):Promise<CaseNoticeIndex>{const value=await read("notices",signal);if(typeof value.revision!=="string")throw new CaseWorkspaceLoadError("unavailable");return {revision:value.revision,items:value.items};}
export async function loadCaseTalkPreviews(signal:AbortSignal):Promise<readonly CaseTalkPreview[]>{return (await read("talks",signal)).items.filter((item:unknown):item is CaseTalkPreview=>!!item&&typeof (item as CaseTalkPreview).projectId==="string"&&typeof (item as CaseTalkPreview).messageId==="string"&&typeof (item as CaseTalkPreview).excerpt==="string");}
