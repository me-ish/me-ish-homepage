"use client";
import {useEffect,useRef,useState} from "react";
import {loadCaseHistory,CaseHistoryChangedError} from "../../data/supabaseCaseHistory";
import {CaseWorkspaceLoadError} from "../../types/caseWorkspaceLoad";
import {CASE_HISTORY_SOURCES,type CaseHistoryView,type CaseFinancialDisplay} from "../../lib/caseHistory";
import {getNatoriProjectActivityLabel,type NatoriProjectActivityEventType} from "../../lib/projectActivity";
import {caseTime} from "../../lib/caseWorkspacePresentation";
import {natoriAdminUi as ui} from "../../constants/adminUi";
import type {CaseSection} from "../../types/caseWorkspace";
const money=(value:number|null)=>value===null?"未確認":`${value.toLocaleString('ja-JP')}円`;
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
 return <section hidden={!active} className="mt-4 space-y-4" aria-label="案件の履歴と金銭参照">
  <div className="rounded-2xl border bg-white p-4 sm:p-5"><h3 className="font-semibold">入金・返金の保存記録</h3>
   {financial?<><dl className="my-3 grid gap-2 sm:grid-cols-3"><div><dt>確認できた元の入金</dt><dd>{money(financial.gross)}</dd></div><div><dt>照合済みの確定返金</dt><dd>{money(financial.refunded)}</dd></div><div><dt>純入金</dt><dd>{money(financial.net)}</dd></div></dl>
    <p className="text-sm">{financial.method==="manual"?"担当者の手動入金記録":financial.method==="stripe"?"入金台帳との対応記録":"旧記録または方式未確認"} · {financial.confirmedAt?caseTime(financial.confirmedAt):"入金時刻未確認"}</p>
    {financial.legacyRecordedAmount!==null?<p className="mt-2 text-sm">旧方式の金額記録：{money(financial.legacyRecordedAmount)}（台帳との対応未確認。上の確定額や純入金には含めていません）</p>:null}
    <p className="mt-2 text-sm">返金処理中 {financial.pendingCount??"未確認"}件 / 要確認 {financial.reviewCount??"未確認"}件</p>
    {financial.state!=="verified"?<p className="mt-2 text-sm text-amber-900">返金履歴・対応が未確認、または未解決の記録があります。返金総額と純入金は確定していません。登録金額では補っていません。</p>:null}
   </>:<p className="mt-2 text-sm">{pending?"金銭記録を読み取り中":"金銭記録を確認できません。未入金・返金なしとは判断していません。"}</p>}
   <p className="mt-2 text-xs">現在の見積・制作・送信許可とは別の参照です。新しい請求・入金登録・返金は行いません。</p>
   {section==="transaction"?<><p className="mt-2 text-xs">{view?`参照時点：${caseTime(view.observedAt)}`:"参照時点未確認"}</p>{error?<p role="alert">金銭と履歴の最新版を確認できません。先頭から取得し直してください。</p>:null}<button className={`${ui.btnSecondary} mt-3`} disabled={pending} onClick={restart}>金銭と履歴を再取得</button></>:null}
  </div>
  <div hidden={section!=="history"} className="rounded-2xl border bg-white p-4 sm:p-5"><h3 className="font-semibold">保存された履歴</h3>
   <p className="my-2 text-xs">複数の台帳に同じ出来事が記録されます。行数や金額を加算して入金・送信・受取の確定にはしません。上書き前のタスクや記録されなかった過去は復元していません。</p>
   {pending?<p role="status">履歴を読み取り中</p>:null}
   {error?<p role="alert">{error==="changed"?"履歴が更新されました。古いページは表示せず、先頭から確認し直してください。":"履歴を取得できません。このページや全履歴が空とは判断していません。"}</p>:null}
   <button className={ui.btnSecondary} disabled={pending} onClick={restart}>履歴を先頭から再取得</button>
   {view?<><p className="my-3 text-sm" role="status">保存記録 {view.total}件中 {view.total===0?0:view.offset+1}〜{view.offset+view.rows.length}件 · 最終取得 {caseTime(view.observedAt)}{view.offset===0&&view.next===null?"（全件取得済み）":"（ページ取得・全件を同時取得していません）"}</p>
    <details className="my-3 text-xs"><summary>取得対象の台帳と件数</summary><ul>{Object.entries(CASE_HISTORY_SOURCES).map(([key,label])=><li key={key}>{label}：{view.counts[key]??0}件</li>)}</ul></details>
    <ol className="space-y-3">{view.rows.map(row=><li key={row.id} className="rounded-xl border p-3 text-sm">
     <p className="font-semibold">{CASE_HISTORY_SOURCES[row.source]}{row.source==='activity'&&['quote_issued','mail_sent','payment_recorded','delivery_sent','delivery_accepted'].includes(row.kind??'')?`：${getNatoriProjectActivityLabel(row.kind as NatoriProjectActivityEventType)}（旧台帳の記録）`:''}</p>
     <p className="text-xs">{row.occurredAt?caseTime(row.occurredAt):"記録時刻未保存"} · 記録ID {row.recordId}</p>
     {row.kind?<p className="break-all">種類：{row.kind}</p>:null}{row.state?<p>保存上の状態：{row.state}（業務完了とは別）</p>:null}
     {row.source==='work-record'?<p>担当の手動記録・外部由来を含みます。依頼者のサイト上の操作とは別です。</p>:null}
     {row.quoteId?<p>見積：{row.quoteVersion?`第${row.quoteVersion}版`:'版未確認'} · {row.quoteId}{row.quoteMatched===false?'（同案件との対応未確認）':''}</p>:null}
     {row.amount!==null?<p>記録された額：{row.amount.toLocaleString('ja-JP')} {row.currency??'通貨未確認'}（この行だけで入金確定にはしません）</p>:null}
     {row.acceptedAt?<p>承諾／受取の保存時刻：{caseTime(row.acceptedAt)}{row.legacy?'（旧方式・対応は別途確認）':''}</p>:null}
     {row.sentAt?<p>送信受付の保存時刻：{caseTime(row.sentAt)}（到達・既読は別）</p>:null}
     {row.relatedId?<p className="break-all text-xs">参照先ID：{row.relatedId}</p>:null}{row.retentionState==='retired'?<p>本文消去・再実行停止。結果不明を失敗に変更していません。</p>:null}
     {row.source==='notice'&&onNotice?<button className={`${ui.btnSecondary} mt-2`} onClick={()=>onNotice(row.recordId)}>この通知を案件内で確認</button>:null}
     {row.reason?<p>照合上の理由：{row.reason}</p>:null}
    </li>)}</ol>
    <nav aria-label="案件履歴のページ" className="mt-4 flex flex-wrap items-center gap-3"><button className={ui.btnSecondary} disabled={pending||page<=1} onClick={()=>onPage(page-1)}>前の履歴</button><span>{page}ページ</span><button className={ui.btnSecondary} disabled={pending||view.next===null} onClick={()=>onPage(page+1)}>次の履歴</button></nav>
   </>:null}
   {legacy.length?<aside className="mt-5 rounded-xl bg-amber-50 p-3 text-sm"><h4 className="font-semibold">旧メモ内の履歴（担当メモ・対応未確認）</h4><p className="text-xs">保存台帳とは別です。宛先・本文・支払URLは表示しません。</p><ul>{legacy.map((r,i)=><li key={i}>{r.dateISO} · {r.label}</li>)}</ul></aside>:null}
  </div>
 </section>;
}
