"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {CaseSystemAccessRejected,loadCaseSystemReview,submitCaseSystemControl} from "../../data/supabaseCaseSystem";
import type {CaseSystemControlInput,CaseSystemReview} from "../../lib/caseSystemControl";

/** Administrative admission controls remain available inside a held workspace.
 * No automatic retry/resume; every resume binds a newly fetched local revision.
 */
export function CaseSystemControl({onAccessRejected}:{onAccessRejected:()=>void}) {
 const [review,setReview]=useState<CaseSystemReview|null>(null),[busy,setBusy]=useState(false),
  [ack,setAck]=useState(false),[message,setMessage]=useState("");
 const epoch=useRef(0),active=useRef(false),request=useRef<AbortController|null>(null),rejected=useRef(onAccessRejected);
 rejected.current=onAccessRejected;
 const failure=useCallback((error:unknown)=>{
  setReview(null);setAck(false);
  if(error instanceof CaseSystemAccessRejected){epoch.current++;active.current=false;setBusy(false);rejected.current();return;}
  setMessage("うまくいったか分かりません。「いまの状態を見る」を押してください。");
 },[]);
 const refresh=useCallback(async()=>{
  if(active.current)return;active.current=true;setBusy(true);setAck(false);
  request.current?.abort();const controller=new AbortController();request.current=controller;const current=++epoch.current;
  try{const next=await loadCaseSystemReview(controller.signal);if(current===epoch.current){setReview(next);setMessage("");}}
  catch(error){if(current===epoch.current&&!controller.signal.aborted)failure(error);}
  finally{if(current===epoch.current){setBusy(false);active.current=false;}}
 },[failure]);
 const invalidate=useCallback(()=>{epoch.current++;active.current=false;request.current?.abort();},[]);
 useEffect(()=>{void refresh();return invalidate;},[refresh,invalidate]);
 const control=async(action:CaseSystemControlInput["action"])=>{
  if(!review||active.current)return;
  if(!window.confirm(action.startsWith("resume-")?"送信と保存を再開します。止める前に始まっていた処理は、そのまま終わることがあります。続けますか？":"すべての案件で、送信と保存を止めます。これまでの記録は消えません。続けますか？"))return;
  active.current=true;setBusy(true);const current=++epoch.current;
  try{
   await submitCaseSystemControl({action,generation:review.generation,revision:action.startsWith("resume-")?review.revision:null,acknowledgePrior:ack});
   if(current===epoch.current){setReview(null);setAck(false);setMessage("切り替えました。画面を読み込み直すと反映されます。");window.dispatchEvent(new Event("focus"));}
  }catch(error){if(current===epoch.current)failure(error);}
  finally{if(current===epoch.current){setBusy(false);active.current=false;}}
 };
 const held=!!review&&(review.commandsHeld||review.sendersHeld||review.readOnly);
 const btn="min-h-11 rounded-full px-5 text-sm font-semibold disabled:opacity-50";
 // The state comes first and large; only the one action that fits it is a button. Everything else is folded.
 return <section aria-label="緊急停止" className="my-4 space-y-3">
  {message?<p role="status" className="text-sm">{message}</p>:null}
  {!review?<div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 p-4"><p className="text-sm text-zinc-600">{busy?"いまの状態を読み込んでいます…":"いまの状態が分かりません。"}</p><button disabled={busy} onClick={()=>void refresh()} className={`${btn} border border-zinc-300`}>いまの状態を見る</button></div>:<>
   <div className={`rounded-2xl p-4 ${held?"bg-red-50 text-red-900":"bg-emerald-50 text-emerald-900"}`}>
    <p className="text-base font-bold">{review.readOnly?"見るだけにしています":held?"止めています":"いつも通り動いています"}</p>
    <p className="mt-1 text-sm">保存：{review.commandsHeld?"止めています":"使えます"} ／ 送信：{review.sendersHeld?"止めています":"使えます"}</p>
    {held?<p className="mt-1 text-xs">止めている間も、お客さんのOKや入金は記録されます。送ったメールは取り消せません。</p>:null}
   </div>
   {!held?<button disabled={busy} onClick={()=>void control("hold")} className={`${btn} w-full bg-red-700 text-white`}>すべて止める</button>:null}
   {held&&review.armed?<div className="space-y-3 rounded-2xl border border-zinc-200 p-4">
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={ack} disabled={busy} onChange={e=>setAck(e.target.checked)}/> 止める前の処理がこのあと終わることがあると分かりました</label>
    <div className="flex flex-wrap gap-2">
     {review.commandsHeld?<button disabled={busy||!ack} onClick={()=>void control("resume-commands")} className={`${btn} border border-zinc-300`}>保存だけ再開する</button>:null}
     {!review.commandsHeld&&!review.readOnly&&review.sendersHeld?<button disabled={busy||!ack} onClick={()=>void control("resume-senders")} className={`${btn} border border-zinc-300`}>送信も再開する</button>:null}
    </div>
    {review.commandsHeld?<p className="text-xs text-zinc-600">保存を再開したあと、送信を再開できます。</p>:null}
   </div>:null}
   <details className="rounded-2xl border border-zinc-200 p-3 text-sm">
    <summary className="cursor-pointer font-semibold">くわしく</summary>
    <div className="mt-3 space-y-3">
     <p>要確認 {review.localUnknownRecords} 件、処理中 {review.localInFlightRecords} 件。</p>
     {review.records.length?<details><summary className="cursor-pointer">終わっていない処理 {review.records.length} 件</summary>
      <ul className="mt-2 max-h-80 space-y-2 overflow-auto">{review.records.map(record=><li key={`${record.kind}/${record.projectId}/${record.id}`} className="rounded-lg border border-zinc-200 p-2">
       <span>{({notification:"メール", "legacy-mail":"以前のメール", "legacy-consultation":"以前の相談のメール", "payment-ledger":"入金の記録", "link-attempt":"支払いリンクの作成", "payment-operation":"支払いリンクの送信", "current-operation":"見積・支払いリンクの送信", "link-stop":"支払いリンクの停止", reconciliation:"送信結果の確認", "stripe-event":"カード決済の知らせ", refund:"返金", intake:"依頼の受付", consultation:"相談", "upload-credential":"ファイルのアップロード", "delivery-file":"納品ファイル"} as const)[record.kind]}：{record.status}</span>
       {record.leaseUntil?<span className="block text-xs">期限 {new Date(record.leaseUntil).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span>:null}
       <span className="block">{record.unresolved?"要確認。":""}{record.inFlight?"まだ処理中かもしれません。":""}</span>
       {record.projectId?<a href={`/natori/dashboard/cases?case=${record.projectId}&section=transaction`} target="_blank" rel="noopener noreferrer" className="underline">この案件を別のタブで開く</a>:<span>どの案件の処理か分かりません。</span>}
      </li>)}</ul>
     </details>:null}
     <div className="flex flex-wrap gap-2">
      {held?<button disabled={busy} onClick={()=>void control("hold")} className={`${btn} border border-zinc-300`}>送信と保存を止める</button>:null}
      {!review.readOnly?<button disabled={busy} onClick={()=>void control("read-only")} className={`${btn} border border-zinc-300`}>見るだけにする</button>:null}
      <button disabled={busy} onClick={()=>void refresh()} className={`${btn} border border-zinc-300`}>いまの状態を見る</button>
     </div>
    </div>
   </details>
  </>}
 </section>;
}
