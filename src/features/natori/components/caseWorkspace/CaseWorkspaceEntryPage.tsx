import "server-only";
import Link from "next/link";
import { CaseWorkspaceApp } from "./CaseWorkspaceApp";
import type { CaseEntry } from "../../types/caseWorkspace";
import {caseDashboardSystemMode} from "../../server/caseDashboardPreview";
import {acceptancePersonalEventsAvailable} from "../../server/caseAcceptanceEvents";
import {assertCaseReleaseTarget} from "../../server/caseRelease";

export type CaseEntrySearch = Record<string,string|string[]|undefined>;
export async function CaseWorkspaceEntryPage({input,entry="cases",source="all",preview=false,readOnly=false}:{input:CaseEntrySearch;entry?:CaseEntry;source?:"all"|"inquiries"|"estimate";preview?:boolean;readOnly?:boolean}) {
  const search=new URLSearchParams();
  for(const key of ["entry","case","selected","section","q","filter","date","month","notice","page","noticePage","historyPage","source","sort","utility","intakeFilter"])if(typeof input[key]==="string")search.set(key,input[key]);
  if(!search.has("entry"))search.set("entry",entry);
  // Legacy bookmarks identify a project; never accept a caller-controlled URL.
  if(!search.has("case")&&typeof input.project==="string"&&/^[A-Za-z0-9-]{1,80}$/.test(input.project))search.set("case",input.project);
  if(!search.has("case")&&typeof input.inquiry==="string"&&/^[A-Za-z0-9-]{1,80}$/.test(input.inquiry))search.set("case",input.inquiry);
  if(!search.has("source")&&source!=="all")search.set("source",source);
  if(!search.has("section")&&source==="estimate")search.set("section","transaction");
  if(!input.section&&input.view==="conversation")search.set("section","consultation");
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const mode=await caseDashboardSystemMode(),entryTools=mode!=="off",personalEventsEnabled=entryTools&&acceptancePersonalEventsAvailable();
  const showPreviewNotice=preview&&!assertCaseReleaseTarget();
  return <>
    {preview?<aside className="border-b border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{showPreviewNotice?"導線の検証プレビューです。本番切替・実サービス受入は未実施です。":null}<nav aria-label="既存の管理機能" className="mt-2 flex flex-wrap gap-4"><Link href="/natori/inquiries">問い合わせ</Link><Link href="/natori/estimate">見積編集</Link><Link href="/natori/results">実績</Link><Link href="/natori/portfolio/edit">公開ページ編集</Link></nav></aside>:null}
    <CaseWorkspaceApp initialSearch={`?${search}`} today={today} readOnly={readOnly||mode==="read-only"} entryTools={entryTools} personalEventsEnabled={personalEventsEnabled}/>
  </>;
}
