"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { CasePaymentError,readCasePaymentView,postCasePayment } from "../../data/supabaseCasePaymentWorkspace";
import type { CasePaymentView,CasePaymentPreview } from "../../lib/casePaymentWorkspace";
import { caseTime } from "../../lib/caseWorkspacePresentation";
import { workspaceLook as look } from "../../constants/workspaceLook";
type Receipt={operationId:string;token:string};
const key=(id:string)=>`natori-case-payment-v1/${id}`;
const button=look.btnPrimary;
export function CasePaymentPanel({projectId,onChanged}:{projectId:string;onChanged:()=>void}){
 const [view,setView]=useState<CasePaymentView|null>(null),[preview,setPreview]=useState<CasePaymentPreview|null>(null),[receipt,setReceipt]=useState<Receipt|null>(null);
 const [deadline,setDeadline]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[confirmed,setConfirmed]=useState(false);
 const lock=useRef(false),receiptRef=useRef<Receipt|null>(null),scope=useRef(projectId);scope.current=projectId;
 const remember=useCallback((r:Receipt|null)=>{receiptRef.current=r;setReceipt(r);try{if(r)sessionStorage.setItem(key(projectId),JSON.stringify(r));else sessionStorage.removeItem(key(projectId));}catch{/* Server receipt remains available after begin. */}},[projectId]);
 const fail=(e:unknown)=>{setError(e instanceof CasePaymentError?e.message:"送れたか分かりません。もう一度送る前に「結果を見る」を押してください。");if(e instanceof CasePaymentError&&e.unauthorized){setPreview(null);setView(null);}};
 const refresh=useCallback(async(signal?:AbortSignal)=>{
  const v=await readCasePaymentView(projectId,receiptRef.current?.operationId,signal);if(scope.current!==projectId||signal?.aborted)return;
  setView(v);setError("");
  if(v?.operationState==="completed"||v?.operationState==="rejected"||v?.operationState==="retired"){remember(null);setPreview(null);setConfirmed(false);}
  else if(v?.receipt&&v.operationId)remember({token:v.receipt,operationId:v.operationId});
 },[projectId,remember]);
 useEffect(()=>{
  const controller=new AbortController();setPreview(null);setView(null);setError("");setConfirmed(false);receiptRef.current=null;
  try{const r=JSON.parse(sessionStorage.getItem(key(projectId))??"null") as Receipt|null;if(r?.operationId&&r.token){receiptRef.current=r;setReceipt(r);}else setReceipt(null);}catch{setReceipt(null);}
  const load=()=>{void refresh(controller.signal).catch(e=>{if(!controller.signal.aborted){setError(e instanceof Error?e.message:"読み込めませんでした。");if(e instanceof CasePaymentError&&e.unauthorized){setView(null);setPreview(null);}}});};
  load();window.addEventListener("focus",load);return()=>{controller.abort();window.removeEventListener("focus",load);};
 },[projectId,refresh]);
 async function act(command:unknown,submitted?:Receipt){
  if(lock.current)return;lock.current=true;setBusy(true);setError("");
  try{if(submitted)remember(submitted);const d=await postCasePayment(command);if(scope.current!==projectId)return;
   if(d.preview){setPreview(d.preview);setConfirmed(false);}
   else{setPreview(null);if(d.view)setView(d.view);if(d.view?.operationState==="completed"||d.view?.operationState==="rejected"||d.view?.operationState==="retired"||["confirmation_expired","confirmation_stale","blocked","rejected","receipt_retired"].includes(d.result))remember(null);
    if(!["completed","queued"].includes(d.result))setError(d.result==="configuration_changed"?"メールの設定が変わったので、送信を止めました。もう一度内容を見てから送ってください。":d.result==="retry_same_operation"||d.result==="busy"?"まだ処理中です。少し待ってから「結果を見る」を押してください。":"内容が変わったので、送信を止めました。もう一度内容を見てから送ってください。");onChanged();}
  }catch(e){if(scope.current===projectId){setPreview(null);fail(e);}}
  finally{lock.current=false;setBusy(false);}
 }
 if(!view&&!error)return null;
 return <section aria-label="支払いリンクを送る" className="space-y-3">
  <h3 className="sr-only">支払いリンクを送る</h3>
  {error?<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20">{error}</p>:null}
  {view?<><p role="status" className="text-sm">{view.reason}</p><p className="text-xs text-zinc-500">見積 第{view.quoteVersion??"?"}版 · {view.amount?.toLocaleString("ja-JP")}円 · 送ったメール {view.sentCount}通</p>
   {view.jobs.length?<ul className="space-y-1 text-sm">{view.jobs.map(j=><li key={j.id}>{j.attempt}回目：{j.status==="sent"?"送信しました":j.status==="failed"?"送れませんでした":j.status==="unknown"?"送れたか分かりません":"送信待ち"}{j.sentAt?` · ${caseTime(j.sentAt)}`:""}</li>)}</ul>:null}
  </>:null}
  {receipt&&!preview?<div className="space-y-2 rounded-xl bg-amber-50 p-3 ring-1 ring-inset ring-amber-600/20"><p className="text-sm">送信の途中です。まず「結果を見る」を押してください。</p>
    {view?.operationState==="pending"&&view.phase==="processing"?<button type="button" className={button} disabled={busy} onClick={()=>void act({action:"confirm",projectId,...receipt},receipt)}>途中の送信を続ける</button>:!view?.operationId?<button type="button" className={look.btnSecondary} disabled={busy} onClick={()=>{remember(null);setError("送信をやめました。");}}>送信をやめる</button>:null}
   </div>:null}
  {!receipt&&!preview&&view?.canPrepare&&!error?<div className="space-y-3">
   {view.deadlinePolicy==="sent_plus_7_days"?<p className="text-sm">支払い期限は、送った日から7日です。送り直すとその日から7日に延びます。{view.deadline?` いまの期限：${caseTime(view.deadline)}`:""}</p>:!view.deadline?<label className="block text-sm">支払い期限<input aria-label="支払期限" type="datetime-local" value={deadline} onChange={e=>setDeadline(e.target.value)} className="mt-1 block max-w-full rounded-lg border p-2"/></label>:<p className="text-sm">支払い期限：{caseTime(view.deadline)}（送り直しても延びません）</p>}
   <button type="button" className={`${look.btnPrimary} w-full`} disabled={busy||(view.deadlinePolicy!=="sent_plus_7_days"&&!view.deadline&&!deadline)} onClick={()=>{const d=view.deadlinePolicy!=="sent_plus_7_days"&&deadline?new Date(deadline):null;void act({action:"prepare",projectId,...(d&&Number.isFinite(d.getTime())?{deadline:d.toISOString()}:{})});}}>{view.sentCount?"支払いリンクを送り直す":"支払いリンクを送る"}</button>
   <p className="text-xs text-zinc-500">押すと送信前の確認が出ます。まだ送られません。</p>
  </div>:null}
  {!receipt&&!preview&&view?.canRetry&&!error?<button type="button" className={button} disabled={busy} onClick={()=>void act({action:"prepare",projectId,retry:true})}>送れなかったメールを送り直す</button>:null}
  {!receipt&&!preview&&view?.canResume&&!error?<button type="button" className={button} disabled={busy} onClick={()=>void act({action:"prepare",projectId,resume:true})}>止まっている送信を再開する</button>:null}
  {preview?<div className={look.confirm}>
   <h4 className="font-semibold">送る前に見てください · {preview.kind==="initial"?"はじめての案内":preview.kind==="retry"?"送れなかったメールの送り直し":preview.kind==="resume"?"止まっていた送信の再開":"送り直し"}</h4>
   <dl className="space-y-2 break-words text-sm"><div><dt>案件</dt><dd>{preview.projectTitle}</dd></div><div><dt>見積と金額</dt><dd>第{preview.quoteVersion}版 · {preview.amount.toLocaleString("ja-JP")}円</dd></div><div><dt>宛先</dt><dd>{preview.to.join(", ")}</dd></div><div><dt>送り主 / 返信先 / BCC</dt><dd>{preview.from} / {preview.replyTo} / {preview.bcc.join(", ")||"なし"}</dd></div><div><dt>支払い期限</dt><dd>{preview.deadlinePolicy==="sent_plus_7_days"?"送った日から7日（送り直すと延びます）":preview.deadline?caseTime(preview.deadline):"—"}</dd></div><div><dt>件名</dt><dd>{preview.subject}</dd></div></dl>
   <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-sm">{preview.text}</pre>
   {preview.linkPending?<p className="text-sm">支払いリンクは、送る時に作って本文に入れます。</p>:null}
   <p className="text-sm">{caseTime(preview.validUntil)}までに送ってください。</p>
   <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>宛先と金額、本文を見ました</label>
   <div className="flex flex-wrap gap-3"><button type="button" className={button} disabled={busy||!confirmed||Boolean(error)} onClick={()=>{const r={operationId:preview.operationId,token:preview.token};void act({action:"confirm",projectId,...r},r);}}>このメールを送る</button><button type="button" disabled={busy} className={look.btnSecondary} onClick={()=>{setPreview(null);setConfirmed(false);}}>やめる</button></div>
  </div>:null}
  <button type="button" className={look.btnLink} disabled={busy} onClick={()=>{void refresh().then(onChanged).catch(fail);}}>結果を見る</button>
 </section>;
}
