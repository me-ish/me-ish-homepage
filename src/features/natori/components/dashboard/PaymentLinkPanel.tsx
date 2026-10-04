"use client";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import {useEffect,useState} from "react";
import {CSRF_HEADERS} from "@/lib/auth/csrf";
import {paymentLinkRequestSchema,paymentLinkStateSchema,buildGenerationPaymentMail,type PaymentLinkRequest,type PaymentLinkState} from "../../lib/paymentLinkRequest";
import {resolveClientEmail} from "../../lib/orderMail";
import type {NatoriProject} from "../../types/projects";

const toLocal=(value:string)=>{const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);};
const labels:Record<string,string>={absent:"案内未発行",creating:"発行処理中・回収待ち",active:"リンク有効",stop_required:"停止確認待ち",deactivating:"停止処理中",inactive:"停止済み",needs_review:"照合が必要",legacy_review:"既存リンクの照合が必要"};
export default function PaymentLinkPanel({project,onClose,onSent}:{project:NatoriProject;onClose:()=>void;onSent:()=>void}){
 const [state,setState]=useState<PaymentLinkState|null>(null),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false);
 const [action,setAction]=useState<PaymentLinkRequest["action"]>("issue"),[confirmed,setConfirmed]=useState(false),[deadline,setDeadline]=useState("");
 const [to,setTo]=useState(resolveClientEmail(project)??""),[subject,setSubject]=useState(""),[body,setBody]=useState("");
 const [pending,setPending]=useState<PaymentLinkRequest|null>(null),[cacheReady,setCacheReady]=useState(false);
 const key=`natori-payment-link-operation/${project.id}`;
 const clearRejected=(value:unknown,request:PaymentLinkRequest|null)=>{
  if(!request||!value||typeof value!=="object"||!("operationState" in value)||value.operationState!=="rejected"
   ||!("operationId" in value)||value.operationId!==request.operationId)return false;
  sessionStorage.removeItem(key);setPending(null);return true;
 };
 const rejectionMessage="この操作は実行されていません。入力内容を修正して再実行してください。";
 const load=async(request:PaymentLinkRequest|null=pending)=>{const res=await fetch(`/api/natori/admin/payment-link?projectId=${encodeURIComponent(project.id)}`+(request?"&operationId="+encodeURIComponent(request.operationId):""),{cache:"no-store"});
  const json:unknown=await res.json();if(!res.ok||!json||typeof json!=="object"||!("state" in json))throw new Error("支払状態を確認できません。再読込してください。");
  const view=paymentLinkStateSchema.parse(json.state);setState(view);if(clearRejected(json,request))setError(rejectionMessage);return view;};
 useEffect(()=>{let active=true;let restored:PaymentLinkRequest|null=null;
  const restore=(request:PaymentLinkRequest)=>{setPending(request);setAction(request.action);setTo(request.to??"");setSubject(request.subject??"");setBody(request.body??"");setDeadline(request.deadline?toLocal(request.deadline):"");setConfirmed(request.confirmed??false);};
  try{const raw=sessionStorage.getItem(key);if(raw){const saved=paymentLinkRequestSchema.safeParse(JSON.parse(raw));if(!saved.success||saved.data.projectId!==project.id)throw new Error();restored=saved.data;restore(saved.data);}setCacheReady(true);}
  catch{setError("前回の操作記録を読み取れません。管理者に確認してください。");return;}
  void load(restored).then(view=>{if(!active)return;const draft=buildGenerationPaymentMail(project.clientName,project.title,view.amount??0);
   if(!restored){setSubject(draft.subject);setBody(draft.body);setAction(view.state==="active"?"renotify":view.state==="inactive"?"reissue":view.state==="legacy_review"?"adopt":"issue");}}
  ).catch(e=>{if(active)setError(e instanceof Error?e.message:"読込に失敗しました。");});return()=>{active=false;};
  // The dialog is bound to a single project; request restoration must precede any editing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[project.id]);
 const frozen=busy||!!pending,needsMail=["issue","reissue","renotify"].includes(action),needsDeadline=["issue","reissue","extend"].includes(action);
 const allowed=state&&!state.terminal&&!state.confirmedAt&&state.canIssue&&
  (action==="issue"?state.state==="absent":action==="reissue"?state.state==="inactive":action==="adopt"?state.state==="legacy_review":state.state==="active");
 const send=async()=>{if(!cacheReady||busy||(!pending&&!allowed))return;setBusy(true);setError(null);
  try{if(!pending&&needsDeadline&&!Number.isFinite(Date.parse(deadline)))throw new Error("支払期限を入力してください。");
   const candidate=pending??{projectId:project.id,operationId:crypto.randomUUID(),action,
   ...(["renotify","extend"].includes(action)?{revision:state!.revision}:{}),...(needsDeadline?{deadline:new Date(deadline).toISOString()}:{}),
   ...(["reissue","extend","adopt"].includes(action)?{confirmed}:{}),...(needsMail?{to,subject,body}:{})};
   const parsed=paymentLinkRequestSchema.safeParse(candidate);if(!parsed.success)throw new Error("送信先・件名・本文・期限と確認チェックを見直してください。");const request=parsed.data;
   sessionStorage.setItem(key,JSON.stringify(request));setPending(request);
   const res=await fetch("/api/natori/admin/payment-link",{method:"POST",headers:{...CSRF_HEADERS,"Content-Type":"application/json"},body:JSON.stringify(request)});
   const data=await res.json() as {ok?:boolean;error?:string;state?:unknown;operationState?:string;operationId?:string;reason?:string};
   if(!res.ok||!data.ok){if(clearRejected(data,request))throw new Error(rejectionMessage);throw new Error(data.error??"結果を確認できません。同じ操作で再試行してください。");}
   const view=paymentLinkStateSchema.parse(data.state);setState(view);sessionStorage.removeItem(key);setPending(null);setConfirmed(false);onSent();
   setAction(view.state==="active"?"renotify":view.state==="inactive"?"reissue":"issue");
  }catch(e){setError(e instanceof Error?e.message:"同じ操作で再試行してください。");}finally{setBusy(false);}
 };
 return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-zinc-900/60 p-4" role="dialog" aria-modal="true" aria-label="支払リンクの管理">
  <section className="w-full max-w-2xl space-y-4 rounded-2xl bg-white p-5 text-zinc-900">
   <h2 className="font-bold">支払リンクの管理</h2><p className="break-words text-sm">{project.title}</p>
   <p role="status">{state?.confirmedAt?"入金確認済み":state?.terminal?"終了済み":state?labels[state.state]??"照合が必要":"状態を読込中"}</p>
   {state?.deadline&&<p>現在の支払期限: {new Date(state.deadline).toLocaleString("ja-JP")}</p>}
   {state?.notificationStatus&&<p>通知: {state.notificationStatus==="sent"?"送信済み":state.notificationStatus==="failed"?"送信失敗":state.notificationStatus==="unknown"?"送信結果の確認が必要":"送信待ち・処理中"}</p>}
   <p className="text-sm">再通知で期限は延長されません。延長と再発行は別の操作です。停止確認が終わるまで新しいリンクは発行しません。</p>
   {pending&&<p className="rounded bg-amber-50 p-3 text-amber-950">前回の結果を確認中です。保存した同じ内容で再試行します。</p>}
   <label className="block">操作<select aria-label="支払リンク操作" value={action} disabled={frozen||!state} onChange={e=>{setAction(e.target.value as PaymentLinkRequest["action"]);setConfirmed(false);}} className={natoriAdminUi.input}>
    <option value="issue">初回発行と案内</option><option value="renotify">同じリンクを再通知</option><option value="extend">現在の期限を延長</option><option value="reissue">停止済みリンクを新世代へ再発行</option><option value="adopt">既存リンクのURL・旧期限を照合して引継ぎ</option>
   </select></label>
   {needsDeadline&&<label className="block">新しい支払期限（端末の時刻）<input aria-label="新しい支払期限" type="datetime-local" value={deadline} disabled={frozen} onChange={e=>setDeadline(e.target.value)} className={`${natoriAdminUi.input} mt-1`}/></label>}
   {needsMail&&<fieldset disabled={frozen} className="space-y-3">
    <label className="block">送信先<input aria-label="支払案内の送信先" type="email" value={to} onChange={e=>setTo(e.target.value)} className={natoriAdminUi.input}/></label>
    <label className="block">件名<input aria-label="支払案内の件名" value={subject} onChange={e=>setSubject(e.target.value)} className={natoriAdminUi.input}/></label>
    <label className="block">本文<textarea aria-label="支払案内の本文" rows={6} value={body} onChange={e=>setBody(e.target.value)} className={natoriAdminUi.input}/></label>
   </fieldset>}
   {["extend","reissue","adopt"].includes(action)&&<label className="flex gap-2"><input type="checkbox" className={natoriAdminUi.checkbox} checked={confirmed} disabled={frozen} onChange={e=>setConfirmed(e.target.checked)}/>{action==="extend"?"現在の期限を延長することを確認しました":action==="reissue"?"旧リンクの停止を確認し、新しいリンクを発行します":"既存のURLと旧期限を保持して引き継ぐことを確認しました"}</label>}
   {error&&<p role="alert" className="break-words rounded bg-red-50 p-3 text-red-900">{error}</p>}
   <div className="flex flex-wrap gap-3"><button type="button" onClick={()=>{void load().catch(()=>setError("状態を確認できません。再読込してください。"));}} disabled={busy} className="min-h-11 rounded border px-3">状態を再読込</button>
    <button type="button" onClick={()=>void send()} disabled={busy||!cacheReady||(!pending&&!allowed)} className={natoriAdminUi.btnPrimary}>{busy?"処理結果を確認中":pending?"同じ操作で再試行":"選んだ操作を実行"}</button>
    <button type="button" onClick={onClose} disabled={busy} className="min-h-11 px-3 underline">閉じる</button></div>
  </section></div>;
}
