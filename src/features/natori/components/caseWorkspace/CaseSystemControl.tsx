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
  setMessage("結果を確認できません。自動では再実行しません。最新の停止状態を取得してください。");
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
  if(!window.confirm(action.startsWith("resume-")?"表示した記録を基に受付を再開します。先行処理は完了する可能性があり、要確認は残ります。続けますか？":"新しい操作と送信を停止します。既存の記録や結果不明の処理は消しません。続けますか？"))return;
  active.current=true;setBusy(true);const current=++epoch.current;
  try{
   await submitCaseSystemControl({action,generation:review.generation,revision:action.startsWith("resume-")?review.revision:null,acknowledgePrior:ack});
   if(current===epoch.current){setReview(null);setAck(false);setMessage("停止状態を保存しました。最新状態を取得して確認してください。操作画面の再開には再読み込みが必要です。");window.dispatchEvent(new Event("focus"));}
  }catch(error){if(current===epoch.current)failure(error);}
  finally{if(current===epoch.current){setBusy(false);active.current=false;}}
 };
 return <section aria-label="全体の停止と再開" className="my-4 rounded-xl border border-zinc-300 p-4">
  <h2 className="font-semibold">全体の停止と再開</h2>
  <p className="my-2 text-sm">管理対象の案件全体に適用します。停止は過去の送信・作成の取消ではありません。承諾・入金などの確定事実は引き続き記録します。</p>
  {message?<p role="status" className="my-2 text-sm">{message}</p>:null}
  <button disabled={busy} onClick={()=>void refresh()} className="rounded border px-3 py-2">最新の停止状態を取得</button>
  {review?<>
   <p className="my-2 text-sm">操作受付：{review.commandsHeld?"停止中":"受付中"} ／ 送信受付：{review.sendersHeld?"停止中":"受付中"} ／ 世代：{review.generation}</p>
   <p className="my-2 text-sm">結果不明・要確認のローカル記録 {review.localUnknownRecords} 件、処理中のローカル記録 {review.localInFlightRecords} 件。複数の台帳に同じ処理が含まれます。0件でも外部で未実行だった証明にはなりません。既発行のアップロード権限も停止だけでは無効になりません。</p>
   <details className="my-3 text-sm"><summary>未完了・要確認の保存台帳 {review.records.length} 件（省略なし）</summary>
    <p className="my-2">送信の受付・到達・入金・受取は別の事実です。本文や資格情報は表示しません。要確認は再開後も残ります。</p>
    <ul className="max-h-80 space-y-2 overflow-auto">{review.records.map(record=><li key={`${record.kind}/${record.projectId}/${record.id}`} className="rounded border p-2">
     <span>{({notification:"通知", "legacy-mail":"旧送信記録", "legacy-consultation":"旧相談通知", "payment-ledger":"入金台帳の要確認", "link-attempt":"支払リンク作成", "payment-operation":"支払案内操作", "current-operation":"見積・支払案内の操作", "link-stop":"リンク停止", reconciliation:"結果照合", "stripe-event":"決済通知", refund:"返金の照合記録", intake:"依頼受付", consultation:"相談", "upload-credential":"アップロード権限", "delivery-file":"納品ファイル"} as const)[record.kind]}：{record.status}</span>
     <span className="block break-all text-xs">記録 {record.id}{record.leaseUntil?` ／ 保存された期限 ${new Date(record.leaseUntil).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}`:""}</span>
     <span className="block">{record.unresolved?"要確認。":""}{record.inFlight?"処理中または権限が残っている可能性があります。":""}</span>
     {record.projectId?<a href={`/natori/dashboard/cases?case=${record.projectId}&section=transaction`} target="_blank" rel="noopener noreferrer" className="underline">この案件の記録を別タブで確認</a>:<span>案件との対応は未確定です。</span>}
    </li>)}</ul>
   </details>
   <div className="my-2 flex flex-wrap gap-2">
    <button disabled={busy} onClick={()=>void control("hold")} className="rounded border px-3 py-2">操作と送信を停止</button>
    <button disabled={busy} onClick={()=>void control("read-only")} className="rounded border px-3 py-2">照会のみへ切替</button>
   </div>
   {review.armed?<>
    <label className="my-3 block text-sm"><input type="checkbox" checked={ack} disabled={busy} onChange={e=>setAck(e.target.checked)}/> 先行処理が完了し得ることと、要確認が残ることを確認した</label>
    <div className="flex flex-wrap gap-2">
     <button disabled={busy||!ack||!review.commandsHeld} onClick={()=>void control("resume-commands")} className="rounded border px-3 py-2">操作受付だけ再開</button>
     <button disabled={busy||!ack||review.commandsHeld||review.readOnly||!review.sendersHeld} onClick={()=>void control("resume-senders")} className="rounded border px-3 py-2">送信受付を再開</button>
    </div>
   </>:null}
  </>:null}
 </section>;
}
