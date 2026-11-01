"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import {CaseAdministrationPanel} from "./CaseAdministrationPanel";
import {useCaseDraft} from "./useCaseDraft";
import ConsultationThread from "../consultation/ConsultationThread";
import DeliveryFilesManager from "../dashboard/DeliveryFilesManager";
import type { NatoriDeliveryFileView } from "../../data/supabaseDeliveryFiles";
import { fetchCaseWork,mutateCaseWork } from "../../data/supabaseCaseWork";
import { caseDeliveryRequest,caseWorkLabels,caseOriginLabels,caseWorkNoticeLabel,openCaseRevisions,type CaseWorkView,type CaseDeliveryRequest } from "../../lib/caseWork";
import { buildDeliveryMailDraft,DELIVERY_EXTENSION_DAYS,DELIVERY_VALID_DAYS } from "../../lib/orderMail";
import { caseTime } from "../../lib/caseWorkspacePresentation";
import { natoriAdminUi as ui } from "../../constants/adminUi";
import { workspaceLook as look } from "../../constants/workspaceLook";
import type { CaseOverviewPart, CaseSection } from "../../types/caseWorkspace";

const card=`space-y-4 ${look.cardPadded}`;
const fileTime=(value:string|null|undefined)=>value?caseTime(value):"—";
export function CaseWorkPanel({projectId,section,onChanged,onDraftChange,selectedNotificationId,overviewPart=null,talkEvents}:{talkEvents?:ReadonlyArray<{at:string;text:string}>;selectedNotificationId?:string;projectId:string;section:CaseSection;onChanged:()=>void;onDraftChange:(value:boolean)=>void;overviewPart?:CaseOverviewPart|null}){
 const [view,setView]=useState<CaseWorkView|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[result,setResult]=useState("");
 const [draft,setDraft]=useState(false),[deliveryDraft,setDeliveryDraft]=useState(false);
 const [adminDraft,setAdminDraft]=useState(false),[recordDraft,setRecordDraft]=useState(false),[revisionDraft,setRevisionDraft]=useState(false);
 const gate=useRef(false),alive=useRef(true);
 const load=useCallback(async(operationId?:string)=>{const next=await fetchCaseWork(projectId,operationId);if(alive.current)setView(next);return next;},[projectId]);
 useEffect(()=>{alive.current=true;void load().catch(e=>setError(e.message));return()=>{alive.current=false;};},[load]);
 useEffect(()=>{onDraftChange(draft||deliveryDraft||adminDraft||recordDraft||revisionDraft);return()=>onDraftChange(false);},[draft,deliveryDraft,adminDraft,recordDraft,revisionDraft,onDraftChange]);
 const refresh=async()=>{setError("");try{await load();onChanged();}catch(e){setError(e instanceof Error?e.message:"読み込めませんでした。");setView(null);}};
 const command=async(input:unknown)=>{
  if(gate.current)return false;gate.current=true;setBusy(true);setError("");setResult("");
  try{const response=await mutateCaseWork(input);if(!alive.current)return false;const ok=["applied","unchanged"].includes(response.result??"");
   setResult(ok?"保存しました。":"保存できませんでした。ページを読み込み直してから、もう一度試してください。");
   await load();onChanged();return ok;
  }catch(e){setError(e instanceof Error?e.message:"うまくいったか分かりません。");return false;}finally{gate.current=false;setBusy(false);}
 };
 if(!view)return <section className={card}><p role={error?"alert":"status"}>{error||"読み込み中…"}</p><button className={ui.btnSecondary} onClick={()=>void refresh()}>再読み込み</button></section>;
 const p=view.project,inactive=!!p.deletedAt||p.status==="closed",deliveredStatus=p.status==="delivered"||p.status==="completed",origin=view.records.find(r=>r.kind==="origin");
 return <div className="mt-4 space-y-4">
  {error?<p role="alert" className={ui.alert.warning}>{error}</p>:null}{result?<p role="status">{result}</p>:null}
  
  <CaseAdministrationPanel selectedNotificationId={selectedNotificationId} projectId={projectId} section={section} overviewPart={overviewPart} refreshKey={view.revision} onChanged={()=>void refresh()} onDraftChange={setAdminDraft}/>
  <div hidden={section!=="overview"||overviewPart!=="outside"}>
   <section className={`${card} mt-4`}><h3 className="font-semibold">サイトの外であったこと</h3><p className="text-sm text-zinc-600">{origin?`受けた場所：${caseOriginLabels[origin.data.origin??"unknown"]}`:"メールや SNS で決まったこと、手渡しした納品などを書き残せます。"}</p>
    <WorkRecordForm view={view} disabled={busy||inactive} save={command} onDirty={setRecordDraft}/></section>
  </div>
  <div hidden={section!=="consultation"}>
   
   <ConsultationThread key={projectId} mode="staff" projectId={projectId} clientEmail={p.clientEmail??undefined} closed={inactive} events={talkEvents} readOnlyLookup workspaceExpected={{title:p.title,clientName:p.clientName,email:p.clientEmail}} onChanged={()=>{void refresh();}} onDraftChange={setDraft}/>
  </div>
  <div hidden={section!=="production"} className="space-y-4">
   <section className={card}><h3 className="font-semibold">工程を進める</h3><p className="text-sm text-zinc-600">終わった工程を押してください。</p>
    {p.tasks.filter(t=>t.stage!=="material").map(t=><button key={t.id} aria-pressed={t.done||(t.stage==="delivery"&&deliveredStatus)} disabled={busy||inactive} className={`${ui.btnSecondary} mr-2`} onClick={()=>void command({command:"task",projectId,revision:view.revision,taskKey:t.id,done:!t.done})}>{t.done||(t.stage==="delivery"&&deliveredStatus)?"✓ ":""}{t.label}</button>)}
    {p.type==="undecided"?<label className="block">依頼の種類（選ぶと工程ができます）<select defaultValue="" className={ui.input} disabled={busy||inactive} onChange={e=>{if(e.target.value)void command({command:"confirm_type",projectId,revision:view.revision,projectType:e.target.value});}}><option value="">選択してください</option><option value="icon">アイコン</option><option value="sd">SD</option><option value="standing">立ち絵</option><option value="illustration">イラスト</option></select></label>:null}</section>
   <section className={card}><h3 className="font-semibold">修正の依頼を記録</h3><p className="text-sm text-zinc-600">お客さんのメッセージと、どのラフかを選びます。追加料金がかかる時は、相談で決めてください。</p>
    <RevisionForm view={view} disabled={busy||inactive} save={command} onDirty={setRevisionDraft}/></section>
   <DeliveryWork key={projectId} view={view} disabled={busy||inactive} load={load} onChanged={onChanged} onDraftChange={setDeliveryDraft}/>
  </div>
  <section hidden={section!=="history"} className={card}><h3 className="font-semibold">あなたが書いた記録</h3>
   {view.records.length===0?<p>まだありません。</p>:view.records.map(r=><article key={r.id} className="border-t py-3 text-sm"><p className="font-semibold">{caseWorkLabels[r.kind]}</p><p>{r.data.note}</p>{r.data.target?<p>{r.data.target}</p>:null}<p className="text-zinc-600">{r.data.occurredAt?`${caseTime(r.data.occurredAt)}のこと · `:""}{caseTime(r.created_at)}に記録 · {r.operator.kind==="auth-user"?"ログインした人":"共有の鍵で入った人"}</p></article>)}
  </section>
 </div>;
}
type Save=(input:unknown)=>Promise<boolean>;
function WorkRecordForm({view,disabled,save,onDirty}:{view:CaseWorkView;disabled:boolean;save:Save;onDirty:(dirty:boolean)=>void}){
 const [form,setForm,reset]=useCaseDraft(`natori-case-draft/${view.project.id}/record`,{kind:"manual_agreement",origin:"external",target:"",at:"",note:"",operationId:""},onDirty);
 const {kind,origin,target,at,note}=form;const setKind=(kind:string)=>setForm(v=>({...v,kind})),setOrigin=(origin:string)=>setForm(v=>({...v,origin})),setTarget=(target:string)=>setForm(v=>({...v,target})),setAt=(at:string)=>setForm(v=>({...v,at})),setNote=(note:string)=>setForm(v=>({...v,note}));
 const id=useRef("");
 return <form className="space-y-3" onSubmit={e=>{e.preventDefault();id.current=form.operationId||id.current||crypto.randomUUID();setForm({...form,operationId:id.current});sessionStorage.setItem(`natori-case-draft/${view.project.id}/${"kind" in form?"record":"revision"}`,JSON.stringify({...form,operationId:id.current}));void save({command:"record",projectId:view.project.id,revision:view.revision,id:id.current,kind,data:kind==="origin"?{origin,note}:{target,occurredAt:at?new Date(at).toISOString():null,note}}).then(ok=>{if(ok){id.current="";reset({...form,note:"",operationId:""});}});}}><fieldset disabled={disabled} className="space-y-3">
  <label className="block">何があったか<select className={ui.input} value={kind} onChange={e=>{setKind(e.target.value);id.current="";}}>{["origin","manual_agreement","manual_delivery","manual_receipt","manual_completion"].map(k=><option key={k} value={k}>{caseWorkLabels[k as keyof typeof caseWorkLabels]}</option>)}</select></label>
  {kind==="origin"?<label className="block">受けた場所<select className={ui.input} value={origin} onChange={e=>setOrigin(e.target.value)}>{["internal","external","manual","historical","unknown"].map(o=><option key={o} value={o}>{caseOriginLabels[o as keyof typeof caseOriginLabels]}</option>)}</select></label>:<><label className="block">何について（例：Xで受けた依頼）<input required className={ui.input} value={target} maxLength={500} onChange={e=>setTarget(e.target.value)}/></label><label className="block">いつ<input required type="datetime-local" className={ui.input} value={at} onChange={e=>setAt(e.target.value)}/></label></>}
  <label className="block">メモ<textarea required className={ui.input} value={note} maxLength={2000} onChange={e=>setNote(e.target.value)}/></label><button className={ui.btnSecondary} disabled={disabled}>記録を残す</button>
 </fieldset></form>;
}
function RevisionForm({view,disabled,save,onDirty}:{view:CaseWorkView;disabled:boolean;save:Save;onDirty:(dirty:boolean)=>void}){
 const [form,setForm,reset]=useCaseDraft(`natori-case-draft/${view.project.id}/revision`,{request:"",message:"",rough:"",note:"",operationId:""},onDirty);
 const {request,message,rough,note}=form;const setRequest=(request:string)=>setForm(v=>({...v,request})),setMessage=(message:string)=>setForm(v=>({...v,message})),setRough=(rough:string)=>setForm(v=>({...v,rough})),setNote=(note:string)=>setForm(v=>({...v,note}));const id=useRef("");
 const open=openCaseRevisions(view.records),handled=!!request;
 return <form className="space-y-3" onSubmit={e=>{e.preventDefault();id.current=form.operationId||id.current||crypto.randomUUID();setForm({...form,operationId:id.current});sessionStorage.setItem(`natori-case-draft/${view.project.id}/${"kind" in form?"record":"revision"}`,JSON.stringify({...form,operationId:id.current}));void save({command:"record",projectId:view.project.id,revision:view.revision,id:id.current,kind:handled?"revision_handled":"revision_open",data:handled?{requestId:request,responseMessageId:message,...(rough?{nextRoughId:rough}:{}),note}:{messageId:message,roughId:rough,note}}).then(ok=>{if(ok){id.current="";reset({request:"",message:"",rough:"",note:"",operationId:""});}});}}><fieldset disabled={disabled} className="space-y-3">
  <label className="block">記録すること<select className={ui.input} value={request} onChange={e=>{setRequest(e.target.value);setMessage("");setRough("");id.current="";}}><option value="">新しい修正の依頼</option>{open.map(r=><option key={r.id} value={r.id}>対応した：{r.data.note}</option>)}</select></label>
  <label className="block">{handled?"あなたの返事":"お客さんのメッセージ"}<select required className={ui.input} value={message} onChange={e=>setMessage(e.target.value)}><option value="">選択してください</option>{view.messages.filter(m=>m.sender===(handled?"staff":"client")).map(m=><option key={m.id} value={m.id}>{m.body} · {caseTime(m.created_at)}</option>)}</select></label>
  <label className="block">{handled?"新しいラフ（出した時だけ）":"どのラフか"}<select required={!handled} className={ui.input} value={rough} onChange={e=>setRough(e.target.value)}><option value="">{handled?"なし":"選んでください"}</option>{view.messages.filter(m=>m.rough_id).map(m=><option key={m.id} value={m.rough_id!}>{m.body} · {m.client_ok_at?"OKをもらった":"OKはまだ"}</option>)}</select></label>
  <label className="block">メモ<textarea required className={ui.input} value={note} maxLength={2000} onChange={e=>setNote(e.target.value)}/></label><button className={ui.btnSecondary} disabled={disabled}>記録を残す</button>
 </fieldset></form>;
}
function DeliveryWork({view,disabled,load,onChanged,onDraftChange}:{view:CaseWorkView;disabled:boolean;load:(operationId?:string)=>Promise<CaseWorkView>;onChanged:()=>void;onDraftChange:(v:boolean)=>void}){
 const p=view.project,key=`natori-case-delivery/${p.id}`;
 const [files,setFiles]=useState<NatoriDeliveryFileView[]|null>(null),[composeDirty,setComposeDirty]=useState(false);
 const initial=buildDeliveryMailDraft({title:p.title,clientName:p.clientName});
 const [compose,setCompose]=useCaseDraft(`natori-case-draft/${p.id}/delivery`,{to:p.clientEmail??"",subject:initial.subject,body:initial.body},setComposeDirty);
 const to=compose.to,draft={subject:compose.subject,body:compose.body};const setTo=(to:string)=>setCompose(v=>({...v,to})),setDraft=(draft:{subject:string;body:string})=>setCompose(v=>({...v,...draft}));
 const [frozen,setFrozen]=useState<CaseDeliveryRequest|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[days,setDays]=useState(0),[reason,setReason]=useState("");
 const [unknown,setUnknown]=useState(false);const lock=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;try{const raw=sessionStorage.getItem(key);if(raw){setFrozen(caseDeliveryRequest.parse(JSON.parse(raw)));setUnknown(true);}}catch{setMessage("前の送信の記録を読み込めませんでした。もう一度送る前に「結果を見る」を押してください。");setUnknown(true);}return()=>{mounted.current=false;};},[key]);
 useEffect(()=>{onDraftChange(!!frozen||composeDirty);return()=>onDraftChange(false);},[frozen,composeDirty,onDraftChange]);
 const lookup=async()=>{try{const current=await load(frozen?.operationId);setMessage(current.operation?`納品しました。メール：${caseWorkNoticeLabel(current.operation.status)}`:"まだ納品の記録はありません。");}catch{setMessage("結果を読み込めませんでした。少し待ってから、もう一度押してください。");}};
 const prepare=async()=>{if(lock.current)return;lock.current=true;setBusy(true);try{
  const current=await load();if(!files?.length||files.some(f=>f.state!=="ready")||current.outboundBlocked)throw Error("ファイルの準備がまだか、終わっていない処理があります。");
  const now=new Date().toISOString(),expiry=days?new Date(Date.parse(now)+days*86400000).toISOString():current.release?.expiresAt??new Date(Date.parse(now)+DELIVERY_VALID_DAYS*86400000).toISOString();
  const value=caseDeliveryRequest.parse({projectId:p.id,operationId:crypto.randomUUID(),revision:current.revision,to:to.trim(),subject:draft.subject,body:draft.body,fileIds:current.files.map(f=>f.id),files:current.files,preparedAt:now,expiresAt:expiry,...(days?{extension:{days,reason}}:{})});
  sessionStorage.setItem(key,JSON.stringify(value));if(mounted.current){setFrozen(value);setUnknown(false);setMessage("まだ送っていません。内容を見てから送ってください。");}
 }catch(e){setMessage(e instanceof Error?e.message:"準備できませんでした。");}finally{lock.current=false;setBusy(false);}};
 const submit=async()=>{if(lock.current||!frozen)return;lock.current=true;setBusy(true);setUnknown(true);
  try{const response=await mutateCaseWork({command:"delivery",request:frozen});if(!mounted.current)return;
   if(response.kind==="ok"||response.kind==="recorded"){setMessage(`納品しました。メール：${caseWorkNoticeLabel(response.notificationStatus??"")}`);onChanged();await load(frozen.operationId);}
   else setMessage("送れませんでした。「結果を見る」を押してください。");
  }catch(e){if(mounted.current)setMessage(e instanceof Error?e.message:"うまくいったか分かりません。");}finally{lock.current=false;if(mounted.current)setBusy(false);}
 };
 return <section className={card}><h3 className="font-semibold">納品する</h3><DeliveryFilesManager projectId={p.id} folder="final" onFilesChange={setFiles} workspaceSafe/>
  <p className="text-sm text-zinc-600">ファイルを上げてメールを送ると、お客さんが専用のページで受け取ります。</p>
  {view.release?<p>納品した日：{caseTime(view.release.publishedAt)} / ページの期限：{caseTime(view.release.expiresAt)} / {p.deliveryAcceptedAt?"受け取ってもらいました":"受け取りはまだ"}</p>:null}
  {frozen?<div className={look.confirm}><h4 className="font-semibold">送る前に見てください</h4><p>宛先：{frozen.to}</p><p>{p.title} / {frozen.extension?`期限を${frozen.extension.days}日延ばす：${frozen.extension.reason}`:view.release?"納品のメールを送り直す":"はじめての納品"}</p><p>ページの期限：{caseTime(frozen.expiresAt)}</p><ul>{frozen.fileIds.map(id=><li key={id}>{frozen.files.find(f=>f.id===id)?.fileName??id} · {Math.max(1,Math.round((frozen.files.find(f=>f.id===id)?.sizeBytes??0)/1024)).toLocaleString("ja-JP")} KB · {fileTime(frozen.files.find(f=>f.id===id)?.verifiedAt)}</li>)}</ul><p>{frozen.subject}</p><pre className="whitespace-pre-wrap break-words text-sm">{frozen.body}</pre>
   <button className={ui.btnPrimary} disabled={disabled||busy||unknown} onClick={()=>void submit()}>納品してメールを送る</button>
   <button className={ui.btnSecondary} disabled={busy} onClick={()=>void lookup()}>結果を見る</button>
   {unknown?<><p>結果が分かるまで、もう一度は送れません。</p>
    {view.operation&&["sent","failed"].includes(view.operation.status)?<button className={ui.btnSecondary} disabled={busy} onClick={()=>{sessionStorage.removeItem(key);setFrozen(null);setUnknown(false);setMessage("");}}>閉じる</button>:null}
    {!view.operation?<button className={ui.btnSecondary} disabled={disabled||busy} onClick={()=>void(async()=>{const current=await load(frozen.operationId);if(current.operation){setMessage("前の送信の記録が見つかりました。「結果を見る」を押してください。");return;}const now=new Date().toISOString(),expiry=frozen.extension?new Date(Date.parse(now)+frozen.extension.days*86400000).toISOString():current.release?.expiresAt??new Date(Date.parse(now)+DELIVERY_VALID_DAYS*86400000).toISOString();const next={...frozen,revision:current.revision,preparedAt:now,expiresAt:expiry};sessionStorage.setItem(key,JSON.stringify(next));setFrozen(next);setUnknown(false);setMessage("内容を新しくしました。まだ送っていません。");})().catch(()=>setMessage("読み込めませんでした。少し待ってから、もう一度押してください。"))}>内容を新しくする</button>:null}
   </>:<button className={ui.btnSecondary} disabled={busy} onClick={()=>{sessionStorage.removeItem(key);setFrozen(null);setMessage("");}}>やめる</button>}
  </div>:<div className="space-y-3"><label className="block">宛先<input className={ui.input} type="email" value={to} onChange={e=>setTo(e.target.value)}/></label><label className="block">件名<input className={ui.input} value={draft.subject} onChange={e=>setDraft({...draft,subject:e.target.value})}/></label><label className="block">本文<textarea className={ui.input} rows={6} value={draft.body} onChange={e=>setDraft({...draft,body:e.target.value})}/></label>
   {view.release?<><label className="block">ページの期限<select className={ui.input} value={days} onChange={e=>setDays(Number(e.target.value))}><option value={0}>いまの期限のまま</option>{DELIVERY_EXTENSION_DAYS.filter(()=>Date.parse(view.release!.expiresAt)<=Date.now()).map(d=><option key={d} value={d}>{d}日延ばす（前のリンクは使えなくなります）</option>)}</select></label>{days?<label className="block">延ばす理由<input className={ui.input} value={reason} maxLength={200} onChange={e=>setReason(e.target.value)}/></label>:null}</>:null}
   <button className={ui.btnSecondary} disabled={disabled||busy||unknown} onClick={()=>void prepare()}>納品する（送る前に内容を表示）</button></div>}
  {message?<p role="status" className="whitespace-pre-wrap text-sm">{message}</p>:null}
 </section>;
}
