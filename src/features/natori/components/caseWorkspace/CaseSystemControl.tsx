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
 return <section aria-label="緊急停止" className="my-4 rounded-xl border border-zinc-300 p-4">
  <h2 className="font-semibold">緊急停止</h2>
  <p className="my-2 text-sm">困った時に、すべての案件の送信と保存を止めます。送ったメールは取り消せません。お客さんのOKや入金は、止めている間も記録されます。</p>
  {message?<p role="status" className="my-2 text-sm">{message}</p>:null}
  <button disabled={busy} onClick={()=>void refresh()} className="rounded border px-3 py-2">いまの状態を見る</button>
  {review?<>
   <p className="my-2 text-sm">保存：{review.commandsHeld?"止めています":"使えます"} ／ 送信：{review.sendersHeld?"止めています":"使えます"}</p>
   <p className="my-2 text-sm">要確認 {review.localUnknownRecords} 件、処理中 {review.localInFlightRecords} 件。</p>
   <details className="my-3 text-sm"><summary>終わっていない処理 {review.records.length} 件</summary>
    
    <ul className="max-h-80 space-y-2 overflow-auto">{review.records.map(record=><li key={`${record.kind}/${record.projectId}/${record.id}`} className="rounded border p-2">
     <span>{({notification:"メール", "legacy-mail":"以前のメール", "legacy-consultation":"以前の相談のメール", "payment-ledger":"入金の記録", "link-attempt":"支払いリンクの作成", "payment-operation":"支払いリンクの送信", "current-operation":"見積・支払いリンクの送信", "link-stop":"支払いリンクの停止", reconciliation:"送信結果の確認", "stripe-event":"カード決済の知らせ", refund:"返金", intake:"依頼の受付", consultation:"相談", "upload-credential":"ファイルのアップロード", "delivery-file":"納品ファイル"} as const)[record.kind]}：{record.status}</span>
     {record.leaseUntil?<span className="block text-xs">期限 {new Date(record.leaseUntil).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span>:null}
     <span className="block">{record.unresolved?"要確認。":""}{record.inFlight?"まだ処理中かもしれません。":""}</span>
     {record.projectId?<a href={`/natori/dashboard/cases?case=${record.projectId}&section=transaction`} target="_blank" rel="noopener noreferrer" className="underline">この案件を別のタブで開く</a>:<span>どの案件の処理か分かりません。</span>}
    </li>)}</ul>
   </details>
   <div className="my-2 flex flex-wrap gap-2">
    <button disabled={busy} onClick={()=>void control("hold")} className="rounded border px-3 py-2">送信と保存を止める</button>
    <button disabled={busy} onClick={()=>void control("read-only")} className="rounded border px-3 py-2">見るだけにする</button>
   </div>
   {review.armed?<>
    <label className="my-3 block text-sm"><input type="checkbox" checked={ack} disabled={busy} onChange={e=>setAck(e.target.checked)}/> 止める前の処理がこのあと終わることがあると分かりました</label>
    <div className="flex flex-wrap gap-2">
     <button disabled={busy||!ack||!review.commandsHeld} onClick={()=>void control("resume-commands")} className="rounded border px-3 py-2">保存だけ再開する</button>
     <button disabled={busy||!ack||review.commandsHeld||review.readOnly||!review.sendersHeld} onClick={()=>void control("resume-senders")} className="rounded border px-3 py-2">送信も再開する</button>
    </div>
   </>:null}
  </>:null}
 </section>;
}
