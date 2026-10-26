"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { CasePaymentError,readCasePaymentView,postCasePayment } from "../../data/supabaseCasePaymentWorkspace";
import type { CasePaymentView,CasePaymentPreview } from "../../lib/casePaymentWorkspace";
import { caseTime } from "../../lib/caseWorkspacePresentation";
type Receipt={operationId:string;token:string};
const key=(id:string)=>`natori-case-payment-v1/${id}`;
const button="rounded-xl bg-pink-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50";
export function CasePaymentPanel({projectId,onChanged}:{projectId:string;onChanged:()=>void}){
 const [view,setView]=useState<CasePaymentView|null>(null),[preview,setPreview]=useState<CasePaymentPreview|null>(null),[receipt,setReceipt]=useState<Receipt|null>(null);
 const [deadline,setDeadline]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[confirmed,setConfirmed]=useState(false);
 const lock=useRef(false),receiptRef=useRef<Receipt|null>(null),scope=useRef(projectId);scope.current=projectId;
 const remember=useCallback((r:Receipt|null)=>{receiptRef.current=r;setReceipt(r);try{if(r)sessionStorage.setItem(key(projectId),JSON.stringify(r));else sessionStorage.removeItem(key(projectId));}catch{/* Server receipt remains available after begin. */}},[projectId]);
 const fail=(e:unknown)=>{setError(e instanceof CasePaymentError?e.message:"結果を確認できません。送信し直さず結果を照会してください。");if(e instanceof CasePaymentError&&e.unauthorized){setPreview(null);setView(null);}};
 const refresh=useCallback(async(signal?:AbortSignal)=>{
  const v=await readCasePaymentView(projectId,receiptRef.current?.operationId,signal);if(scope.current!==projectId||signal?.aborted)return;
  setView(v);setError("");
  if(v?.operationState==="completed"||v?.operationState==="rejected"||v?.operationState==="retired"){remember(null);setPreview(null);setConfirmed(false);}
  else if(v?.receipt&&v.operationId)remember({token:v.receipt,operationId:v.operationId});
 },[projectId,remember]);
 useEffect(()=>{
  const controller=new AbortController();setPreview(null);setView(null);setError("");setConfirmed(false);receiptRef.current=null;
  try{const r=JSON.parse(sessionStorage.getItem(key(projectId))??"null") as Receipt|null;if(r?.operationId&&r.token){receiptRef.current=r;setReceipt(r);}else setReceipt(null);}catch{setReceipt(null);}
  const load=()=>{void refresh(controller.signal).catch(e=>{if(!controller.signal.aborted){setError(e instanceof Error?e.message:"状態を確認できません。");if(e instanceof CasePaymentError&&e.unauthorized){setView(null);setPreview(null);}}});};
  load();window.addEventListener("focus",load);return()=>{controller.abort();window.removeEventListener("focus",load);};
 },[projectId,refresh]);
 async function act(command:unknown,submitted?:Receipt){
  if(lock.current)return;lock.current=true;setBusy(true);setError("");
  try{if(submitted)remember(submitted);const d=await postCasePayment(command);if(scope.current!==projectId)return;
   if(d.preview){setPreview(d.preview);setConfirmed(false);}
   else{setPreview(null);if(d.view)setView(d.view);if(d.view?.operationState==="completed"||d.view?.operationState==="rejected"||d.view?.operationState==="retired"||["confirmation_expired","confirmation_stale","blocked","rejected","receipt_retired"].includes(d.result))remember(null);
    if(!["completed","queued"].includes(d.result))setError(d.result==="configuration_changed"?"メール設定が確認時から変わりました。送信を止めています。":d.result==="retry_same_operation"||d.result==="busy"?"処理が未完了です。結果を照会して、保存済みの同じ準備を確認してください。":"確認対象または処理結果が変わりました。現在の記録を照会し、確認し直してください。");onChanged();}
  }catch(e){if(scope.current===projectId){setPreview(null);fail(e);}}
  finally{lock.current=false;setBusy(false);}
 }
 if(!view&&!error)return null;
 return <section aria-label="支払案内の操作" className="space-y-3">
  <h3 className="sr-only">支払案内をこの案件で確認</h3>
  {error?<p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm">{error}</p>:null}
  {view?<><p role="status" className="text-sm">{view.reason}</p><p className="text-xs text-zinc-500">見積 第{view.quoteVersion??"?"}版 · {view.amount?.toLocaleString("ja-JP")}円 · 送信サービス受付 {view.sentCount}件</p>
   {view.jobs.length?<ul className="space-y-1 text-sm">{view.jobs.map(j=><li key={j.id}>試行{j.attempt}：{j.status==="sent"?"送信サービス受付済み（到達・既読とは別の記録）":j.status==="failed"?"確定失敗":j.status==="unknown"?"受付結果不明":"送信ジョブ受付済み"}{j.sentAt?` · ${caseTime(j.sentAt)}`:""}</li>)}</ul>:null}
  </>:null}
  {receipt&&!preview?<div className="space-y-2 rounded-xl bg-amber-50 p-3"><p className="text-sm">確認済みの操作を保持しています。まず結果を照会してください。リンク準備が未完了の場合だけ、同じ操作を続けられます。</p>
    {view?.operationState==="pending"&&view.phase==="processing"?<button type="button" className={button} disabled={busy} onClick={()=>void act({action:"confirm",projectId,...receipt},receipt)}>保存済みの同じ準備を続ける</button>:!view?.operationId?<button type="button" className="rounded-lg border px-3 py-2 text-sm" disabled={busy} onClick={()=>{remember(null);setError("未開始の確認を閉じました。現在の記録から確認し直してください。");}}>未開始の確認を閉じる</button>:null}
   </div>:null}
  {!receipt&&!preview&&view?.canPrepare&&!error?<div className="space-y-3">
   {view.deadlinePolicy==="sent_plus_7_days"?<p className="text-sm">送信成功から7日を自動設定します。再送に成功すると、その日から7日に延長します。{view.deadline?` 現在の期限：${caseTime(view.deadline)}`:""}</p>:!view.deadline?<label className="block text-sm">支払期限（端末の現地時刻）<input aria-label="支払期限" type="datetime-local" value={deadline} onChange={e=>setDeadline(e.target.value)} className="mt-1 block max-w-full rounded-lg border p-2"/></label>:<p className="text-sm">現行の支払期限：{caseTime(view.deadline)}（再送で延長しません）</p>}
   <button type="button" className="w-full rounded-xl bg-pink-700 px-4 py-4 text-base font-semibold text-white disabled:opacity-50" disabled={busy||(view.deadlinePolicy!=="sent_plus_7_days"&&!view.deadline&&!deadline)} onClick={()=>{const d=view.deadlinePolicy!=="sent_plus_7_days"&&deadline?new Date(deadline):null;void act({action:"prepare",projectId,...(d&&Number.isFinite(d.getTime())?{deadline:d.toISOString()}:{})});}}>{view.sentCount?"再送の内容を確認":"初回案内の内容を確認"}</button>
   <p className="text-xs text-zinc-500">押すと送信前の確認が出ます。まだ送られません。</p>
  </div>:null}
  {!receipt&&!preview&&view?.canRetry&&!error?<button type="button" className={button} disabled={busy} onClick={()=>void act({action:"prepare",projectId,retry:true})}>確定失敗した同じ内容の再試行を確認</button>:null}
  {!receipt&&!preview&&view?.canResume&&!error?<button type="button" className={button} disabled={busy} onClick={()=>void act({action:"prepare",projectId,resume:true})}>未送信の同じ案内を再確認して再開</button>:null}
  {preview?<div className="space-y-3 rounded-xl bg-pink-50 p-4">
   <h4 className="font-semibold">送信前確認 · {preview.kind==="initial"?"初回案内":preview.kind==="retry"?"確定失敗の再試行":preview.kind==="resume"?"未送信ジョブの再開":"再送"}</h4>
   <dl className="space-y-2 break-words text-sm"><div><dt>対象案件</dt><dd>{preview.projectTitle}</dd></div><div><dt>対象見積・金額</dt><dd>第{preview.quoteVersion}版 · {preview.amount.toLocaleString("ja-JP")}円</dd></div><div><dt>宛先</dt><dd>{preview.to.join(", ")}</dd></div><div><dt>差出人 / 返信先 / BCC</dt><dd>{preview.from} / {preview.replyTo} / {preview.bcc.join(", ")||"なし"}</dd></div><div><dt>支払期限</dt><dd>{preview.deadlinePolicy==="sent_plus_7_days"?"送信成功から7日（再送成功で延長）":preview.deadline?caseTime(preview.deadline):"未確認"}</dd></div><div><dt>件名</dt><dd>{preview.subject}</dd></div></dl>
   <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-sm">{preview.text}</pre>
   {preview.linkPending?<p className="text-sm">支払リンクは未発行です。実行後に生成される同じ見積・金額のリンクを本文へ挿入します。</p>:null}
   <p className="text-sm">確認の有効期限：{caseTime(preview.validUntil)}。送信サービスの受付と、到達・入金は別です。</p>
   <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>宛先・金額・見積・期限・内容を確認しました</label>
   <div className="flex flex-wrap gap-3"><button type="button" className={button} disabled={busy||!confirmed||Boolean(error)} onClick={()=>{const r={operationId:preview.operationId,token:preview.token};void act({action:"confirm",projectId,...r},r);}}>確認した案内を実行</button><button type="button" disabled={busy} className="rounded-lg border px-3 py-2 text-sm" onClick={()=>{setPreview(null);setConfirmed(false);}}>確認を閉じる</button></div>
  </div>:null}
  <button type="button" className="rounded-lg px-1 py-2 text-sm font-semibold text-pink-800 underline-offset-4 hover:underline disabled:opacity-50" disabled={busy} onClick={()=>{void refresh().then(onChanged).catch(fail);}}>送信せず結果を照会</button>
 </section>;
}
