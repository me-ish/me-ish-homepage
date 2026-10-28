"use client";
import type {CaseNoticeIndex,CaseNoticeIndexItem} from "../../types/caseEntryIndex";
import type {CaseWorkspaceRecord} from "../../types/caseWorkspace";
import type {CaseWorkspaceLocation} from "../../lib/caseWorkspaceNavigation";
import {notificationPurposeName} from "../../lib/notificationLabels";
import {matchesCaseEntry} from "../../lib/caseWorkspaceEntries";
import {caseTime} from "../../lib/caseWorkspacePresentation";
import {natoriAdminUi as ui} from "../../constants/adminUi";

export function CaseNoticePages({index,available,records,nav,href,onMove}:{index:CaseNoticeIndex|null;available:boolean;records:readonly CaseWorkspaceRecord[];nav:CaseWorkspaceLocation;href:(nav:CaseWorkspaceLocation)=>string;onMove:(nav:CaseWorkspaceLocation)=>void}){
 const byId=new Map(records.map(row=>[row.id,row]));
 const rows=index?.items.filter(row=>{const record=byId.get(row.projectId);return record&&matchesCaseEntry(record,{...nav,entry:"cases"});})??[];
 const pages=Math.max(1,Math.ceil(rows.length/50)),slice=rows.slice((nav.noticePage-1)*50,nav.noticePage*50);
 return <section aria-label="メールの一覧" className="mb-5 space-y-2 rounded-xl border border-zinc-200 bg-white p-3">
  <h2 className="text-sm font-semibold">送ったメール</h2>
  {!available?<p role="status" className="text-xs text-amber-900">メールの一覧を読み込めませんでした。「予定と通知を再読み込み」を押してください。</p>:<><p className="text-xs">{rows.length}件 · {nav.noticePage} / {pages}ページ</p>
   {slice.map(row=>{const next={...nav,projectId:row.projectId,selectedId:row.projectId,noticeId:row.id,section:noticeSection(row)};return <a id={`index-notice-${row.id}`} key={row.id} href={href(next)} onClick={e=>{if(e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();onMove(next);}} className={`block rounded-lg border p-3 text-sm ${ui.focusRing}`}><span className="block font-semibold">{row.projectTitle} · {notificationPurposeName(row.purpose)}</span><span className="block text-xs">{row.status==="sent"?"送信しました":row.status==="failed"?"送れませんでした":row.status==="pending"?"送信待ち":"送れたか分かりません"}{row.attemptNo>1?` · ${row.attemptNo}回目`:""} · {caseTime(row.recordedAt)}</span></a>;})}
   {nav.noticePage>pages?<p>一覧が変わりました。最初のページから見てください。</p>:rows.length===0?<p className="text-xs">この条件のメールはありません。</p>:null}
   <div className="flex flex-wrap gap-2"><button className={ui.btnSecondary} disabled={nav.noticePage<=1} onClick={()=>onMove({...nav,noticePage:Math.max(1,nav.noticePage-1)})}>前へ</button><button className={ui.btnSecondary} disabled={nav.noticePage>=pages} onClick={()=>onMove({...nav,noticePage:nav.noticePage+1})}>次へ</button>{nav.noticePage>pages?<button className={ui.btnSecondary} onClick={()=>onMove({...nav,noticePage:1})}>最初のページへ</button>:null}</div>
  </>}
 </section>;
}
export function noticeSection(row:CaseNoticeIndexItem):CaseWorkspaceLocation["section"]{return row.purpose.startsWith("consultation_")?"consultation":row.purpose==="rough_ok_artist"||row.purpose.startsWith("delivery_")?"production":row.purpose.startsWith("quote_")||row.purpose==="payment_link_client"?"transaction":"history";}
