"use client";
import {useEffect,useRef,useState} from "react";
import {loadCaseHistory,CaseHistoryChangedError} from "../../data/supabaseCaseHistory";
import {CaseWorkspaceLoadError} from "../../types/caseWorkspaceLoad";
import {CASE_HISTORY_SOURCES,type CaseHistoryView,type CaseFinancialDisplay} from "../../lib/caseHistory";
import {getNatoriProjectActivityLabel,type NatoriProjectActivityEventType} from "../../lib/projectActivity";
import {caseTime} from "../../lib/caseWorkspacePresentation";
import {natoriAdminUi as ui} from "../../constants/adminUi";
import type {CaseSection} from "../../types/caseWorkspace";
const money=(value:number|null)=>value===null?"—":`${value.toLocaleString('ja-JP')}円`;
export function CaseHistoryPanel({projectId,section,page,refreshKey,onPage,onAccessRejected,onNotice}:{projectId:string;section:CaseSection;page:number;refreshKey:string;onNotice?:(id:string)=>void;onPage:(page:number)=>void;onAccessRejected:()=>void}){
 const [view,setView]=useState<CaseHistoryView|null>(null),[pending,setPending]=useState(false),[error,setError]=useState<"changed"|"failed"|null>(null),[reload,setReload]=useState(0);
 const [financial,setFinancial]=useState<CaseFinancialDisplay|null>(null),[legacy,setLegacy]=useState<CaseHistoryView['legacyLogs']>([]);
 const cursor=useRef<string|null>(null),rejected=useRef(onAccessRejected);rejected.current=onAccessRejected;
 const active=section==="history"||section==="transaction";
 useEffect(()=>{
  if(!active)return;
  const controller=new AbortController();setPending(true);setView(null);setError(null);if(page===1)setFinancial(null);
  void(async()=>{
   let revision=cursor.current;
   if(revision===null){const first=await loadCaseHistory(projectId,0,null,controller.signal);revision=first.revision;
    if(controller.signal.aborted)return;cursor.current=revision;setFinancial(first.financial);setLegacy(first.legacyLogs);
    if(page===1){setView(first);return;}
   }
   const result=await loadCaseHistory(projectId,(page-1)*50,revision,controller.signal);
   if(!controller.signal.aborted){setView(result);if(page===1){setFinancial(result.financial);setLegacy(result.legacyLogs);}}
  })().catch((e:unknown)=>{
   if(controller.signal.aborted)return;
   setView(null);setFinancial(null);setLegacy([]);
   if(e instanceof CaseWorkspaceLoadError&&(e.kind==="unauthorized"||e.kind==="scope_unavailable"))rejected.current();
   setError(e instanceof CaseHistoryChangedError?"changed":"failed");
  }).finally(()=>{if(!controller.signal.aborted)setPending(false);});
  return()=>controller.abort();
 },[projectId,active,page,reload,refreshKey]);
 const restart=()=>{cursor.current=null;setFinancial(null);setLegacy([]);onPage(1);setReload(v=>v+1);};
 return <section hidden={!active} className="mt-4 space-y-4" aria-label="入金と履歴">
  <div className="rounded-[18px_14px_20px_13px] border-[1.5px] border-[#3B2F33]/25 bg-white p-4 sm:p-5"><h3 className="font-semibold">入金と返金</h3>
   {financial?<>{/* Without refunds the three figures say the same thing, so one line is enough. */}
    {financial.refunded||financial.pendingCount||financial.reviewCount?<dl className="my-3 grid grid-cols-3 gap-2 text-sm"><div><dt className="text-zinc-600">入金</dt><dd className="font-semibold">{money(financial.gross)}</dd></div><div><dt className="text-zinc-600">返金</dt><dd className="font-semibold">{money(financial.refunded)}</dd></div><div><dt className="text-zinc-600">差し引き</dt><dd className="font-semibold">{money(financial.net)}</dd></div></dl>:<p className="mt-2 text-sm font-semibold">入金 {money(financial.gross)}</p>}
    <p className="text-sm">{financial.method===null?"入金の記録はありません":financial.method==="manual"?"あなたが記録した入金":financial.method==="stripe"?"カード決済":"以前の方法での入金"}{financial.method!==null&&financial.confirmedAt?` · ${caseTime(financial.confirmedAt)}`:""}</p>
    {financial.legacyRecordedAmount!==null?<p className="mt-2 text-sm">以前の方法で記録した金額：{money(financial.legacyRecordedAmount)}（上の合計には入れていません）</p>:null}
    {financial.pendingCount||financial.reviewCount?<p className="mt-2 text-sm">返金の手続き中 {financial.pendingCount??"—"}件 / 要確認 {financial.reviewCount??"—"}件</p>:null}
    {financial.state!=="verified"?<p className="mt-2 text-sm text-amber-900">{financial.pendingCount||financial.reviewCount?"終わっていない返金があるので、":"入金と返金の記録を全部は確かめられなかったので、"}差し引きの金額はまだ決まっていません。</p>:null}
   </>:<p className="mt-2 text-sm">{pending?"読み込み中":"入金の記録を読み込めませんでした。"}</p>}
   
   {section==="transaction"?<>{error?<><p role="alert">最新の記録を読み込めませんでした。</p><button className={`${ui.btnSecondary} mt-3`} disabled={pending} onClick={restart}>再読み込み</button></>:null}</>:null}
  </div>
  {/* Every record is one line (date + what happened); its details open on tap. The full list is folded. */}
  <details hidden={section!=="history"} className="rounded-2xl bg-white p-4 sm:p-5"><summary className="cursor-pointer font-semibold">細かい記録{view?`（${view.total}件）`:""}</summary>
   {pending?<p role="status">読み込み中</p>:null}
   {error?<><p role="alert">{error==="changed"?"記録が増えました。最初のページから読み込み直してください。":"記録を読み込めませんでした。"}</p>
   <button className={ui.btnSecondary} disabled={pending} onClick={restart}>最初のページから読み込み直す</button></>:null}
   {view?<><p className="my-3 text-sm" role="status">{view.total}件中 {view.total===0?0:view.offset+1}〜{view.offset+view.rows.length}件{view.offset===0&&view.next===null?"（全件）":""}</p>
    <ol className="divide-y divide-black/[0.08]">{view.rows.map(row=><li key={row.id} className="text-sm"><details>
     <summary className="flex min-h-11 cursor-pointer items-center gap-3 py-1.5"><span className="w-20 shrink-0 text-xs text-zinc-600">{row.occurredAt?caseTime(row.occurredAt):"日時なし"}</span><span className="min-w-0 font-semibold">{CASE_HISTORY_SOURCES[row.source]}{row.source==='activity'&&['quote_issued','mail_sent','payment_recorded','delivery_sent','delivery_accepted'].includes(row.kind??'')?`：${getNatoriProjectActivityLabel(row.kind as NatoriProjectActivityEventType)}`:''}</span></summary>
     <div className="space-y-1 pb-3 pl-[5.75rem]">
     {row.quoteId?<p>見積：{row.quoteVersion?`第${row.quoteVersion}版`:'—'}{row.quoteMatched===false?'（要確認：どの見積か分かりません）':''}</p>:null}
     {row.amount!==null?<p>金額：{row.currency===null||row.currency?.toLowerCase()==='jpy'?`${row.amount.toLocaleString('ja-JP')}円`:`${row.amount.toLocaleString('ja-JP')} ${row.currency}`}</p>:null}
     {row.acceptedAt?<p>OK・受け取り：{caseTime(row.acceptedAt)}</p>:null}
     {row.sentAt?<p>送信：{caseTime(row.sentAt)}</p>:null}
     {row.retentionState==='retired'?<p>本文は消しました。</p>:null}
     {row.source==='notice'&&onNotice?<button className={`${ui.btnSecondary} mt-2`} onClick={()=>onNotice(row.recordId)}>このメールを見る</button>:null}
     {row.reason?<p>理由：{row.reason}</p>:null}
    </div></details></li>)}</ol>
    <nav aria-label="案件履歴のページ" className="mt-4 flex flex-wrap items-center gap-3"><button className={ui.btnSecondary} disabled={pending||page<=1} onClick={()=>onPage(page-1)}>前へ</button><span>{page}ページ</span><button className={ui.btnSecondary} disabled={pending||view.next===null} onClick={()=>onPage(page+1)}>次へ</button></nav>
   </>:null}
   {legacy.length?<aside className="mt-5 rounded-xl bg-amber-50 p-3 text-sm"><h4 className="font-semibold">以前のメモ</h4><ul>{legacy.map((r,i)=><li key={i}>{r.dateISO} · {r.label}</li>)}</ul></aside>:null}
  </details>
 </section>;
}
