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
import type { CaseSection } from "../../types/caseWorkspace";

const card="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5";
const fileTime=(value:string|null|undefined)=>value?caseTime(value):"未確認";
export function CaseWorkPanel({projectId,section,onChanged,onDraftChange,selectedNotificationId}:{selectedNotificationId?:string;projectId:string;section:CaseSection;onChanged:()=>void;onDraftChange:(value:boolean)=>void}){
 const [view,setView]=useState<CaseWorkView|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[result,setResult]=useState("");
 const [draft,setDraft]=useState(false),[deliveryDraft,setDeliveryDraft]=useState(false);
 const [adminDraft,setAdminDraft]=useState(false),[recordDraft,setRecordDraft]=useState(false),[revisionDraft,setRevisionDraft]=useState(false);
 const gate=useRef(false),alive=useRef(true);
 const load=useCallback(async(operationId?:string)=>{const next=await fetchCaseWork(projectId,operationId);if(alive.current)setView(next);return next;},[projectId]);
 useEffect(()=>{alive.current=true;void load().catch(e=>setError(e.message));return()=>{alive.current=false;};},[load]);
 useEffect(()=>{onDraftChange(draft||deliveryDraft||adminDraft||recordDraft||revisionDraft);return()=>onDraftChange(false);},[draft,deliveryDraft,adminDraft,recordDraft,revisionDraft,onDraftChange]);
 const refresh=async()=>{setError("");try{await load();onChanged();}catch(e){setError(e instanceof Error?e.message:"最新状態を取得できません。");setView(null);}};
 const command=async(input:unknown)=>{
  if(gate.current)return false;gate.current=true;setBusy(true);setError("");setResult("");
  try{const response=await mutateCaseWork(input);if(!alive.current)return false;const ok=["applied","unchanged"].includes(response.result??"");
   setResult(ok?"記録を保存しました。サイト上の承諾・受取は変更していません。":"保存できません。別の操作や最新状態を確認して、内容を確認し直してください。");
   await load();onChanged();return ok;
  }catch(e){setError(e instanceof Error?e.message:"結果未確認");return false;}finally{gate.current=false;setBusy(false);}
 };
 if(!view)return <section className={card}><p role={error?"alert":"status"}>{error||"案件の操作情報を確認中…"}</p><button className={ui.btnSecondary} onClick={()=>void refresh()}>操作情報を再取得</button></section>;
 const p=view.project,inactive=!!p.deletedAt||p.status==="closed",origin=view.records.find(r=>r.kind==="origin");
 return <div className="mt-4 space-y-4">
  {error?<p role="alert" className="rounded-xl bg-amber-50 p-4">{error}</p>:null}{result?<p role="status">{result}</p>:null}
  <div className="flex flex-wrap items-center gap-3 text-sm"><button className={ui.btnSecondary} disabled={busy} onClick={()=>void refresh()}>操作情報を再取得</button><span>保存・送信・承諾・受取は別の記録です。</span></div>
  <CaseAdministrationPanel selectedNotificationId={selectedNotificationId} projectId={projectId} section={section} refreshKey={view.revision} onChanged={()=>void refresh()} onDraftChange={setAdminDraft}/>
  <div hidden={section!=="overview"}>
   <section className={`${card} mt-4`}><h3 className="font-semibold">案件の由来と外部での記録</h3><p>{origin?`担当が明示した由来：${caseOriginLabels[origin.data.origin??"unknown"]}`:"由来の担当記録なし。既存メモから推測していません。"}</p>
    <WorkRecordForm view={view} disabled={busy||inactive} save={command} onDirty={setRecordDraft}/></section>
  </div>
  <div hidden={section!=="consultation"}>
   <p className="mb-3 text-sm">この案件の依頼者宛の相談です。本文保存とメール通知の結果は別に表示します。添付した担当メッセージをラフに指定できます。</p>
   <ConsultationThread key={projectId} mode="staff" projectId={projectId} clientEmail={p.clientEmail??undefined} closed={inactive} readOnlyLookup workspaceExpected={{title:p.title,clientName:p.clientName,email:p.clientEmail}} onChanged={()=>{void refresh();}} onDraftChange={setDraft}/>
  </div>
  <div hidden={section!=="production"} className="space-y-4">
   <section className={card}><h3 className="font-semibold">制作タスクを更新</h3><p className="text-sm">実行時の入金・案件状態を既存ルールで確認します。タスク完了は納品・受取ではありません。</p>
    {p.tasks.filter(t=>t.stage!=="material").map(t=><button key={t.id} aria-pressed={t.done} disabled={busy||inactive} className={`${ui.btnSecondary} mr-2`} onClick={()=>void command({command:"task",projectId,revision:view.revision,taskKey:t.id,done:!t.done})}>{t.done?"✓ ":""}{t.label}</button>)}
    {p.type==="undecided"?<label className="block">種別を確定（既存の制作タスクを作成）<select defaultValue="" className={ui.input} disabled={busy||inactive} onChange={e=>{if(e.target.value)void command({command:"confirm_type",projectId,revision:view.revision,projectType:e.target.value});}}><option value="">選択してください</option><option value="icon">アイコン</option><option value="sd">SD</option><option value="standing">立ち絵</option><option value="illustration">イラスト</option></select></label>:null}</section>
   <section className={card}><h3 className="font-semibold">修正への対応を記録</h3><p className="text-sm">依頼者の発言と対象ラフを選びます。「対応済み」は担当の記録で、依頼者OKではありません。追加料金・条件変更は相談へ戻します。</p>
    <RevisionForm view={view} disabled={busy||inactive} save={command} onDirty={setRevisionDraft}/></section>
   <DeliveryWork key={projectId} view={view} disabled={busy||inactive} load={load} onChanged={onChanged} onDraftChange={setDeliveryDraft}/>
  </div>
  <section hidden={section!=="history"} className={card}><h3 className="font-semibold">担当が明示した記録</h3>
   {view.records.length===0?<p>記録なし（取得済み）。過去案件を自動変換していません。</p>:view.records.map(r=><article key={r.id} className="border-t py-3 text-sm"><p className="font-semibold">{caseWorkLabels[r.kind]}</p><p>{r.data.note}</p><p>対象：{r.data.target??r.data.roughId??r.data.requestId??r.data.origin}</p><p>{r.data.occurredAt?`申告された日時：${caseTime(r.data.occurredAt)} · `:""}記録日時：{caseTime(r.created_at)}</p><p>記録者：{r.operator.kind==="auth-user"?r.operator.userId:"共有管理キーによる担当操作（個人識別なし）"}</p></article>)}
  </section>
 </div>;
}
type Save=(input:unknown)=>Promise<boolean>;
function WorkRecordForm({view,disabled,save,onDirty}:{view:CaseWorkView;disabled:boolean;save:Save;onDirty:(dirty:boolean)=>void}){
 const [form,setForm,reset]=useCaseDraft(`natori-case-draft/${view.project.id}/record`,{kind:"manual_agreement",origin:"external",target:"",at:"",note:"",operationId:""},onDirty);
 const {kind,origin,target,at,note}=form;const setKind=(kind:string)=>setForm(v=>({...v,kind})),setOrigin=(origin:string)=>setForm(v=>({...v,origin})),setTarget=(target:string)=>setForm(v=>({...v,target})),setAt=(at:string)=>setForm(v=>({...v,at})),setNote=(note:string)=>setForm(v=>({...v,note}));
 const id=useRef("");
 return <form className="space-y-3" onSubmit={e=>{e.preventDefault();id.current=form.operationId||id.current||crypto.randomUUID();setForm({...form,operationId:id.current});sessionStorage.setItem(`natori-case-draft/${view.project.id}/${"kind" in form?"record":"revision"}`,JSON.stringify({...form,operationId:id.current}));void save({command:"record",projectId:view.project.id,revision:view.revision,id:id.current,kind,data:kind==="origin"?{origin,note}:{target,occurredAt:at?new Date(at).toISOString():null,note}}).then(ok=>{if(ok){id.current="";reset({...form,note:"",operationId:""});}});}}><fieldset disabled={disabled} className="space-y-3">
  <label className="block">記録の種類<select className={ui.input} value={kind} onChange={e=>{setKind(e.target.value);id.current="";}}>{["origin","manual_agreement","manual_delivery","manual_receipt","manual_completion"].map(k=><option key={k} value={k}>{caseWorkLabels[k as keyof typeof caseWorkLabels]}</option>)}</select></label>
  {kind==="origin"?<label className="block">由来<select className={ui.input} value={origin} onChange={e=>setOrigin(e.target.value)}>{["internal","external","manual","historical","unknown"].map(o=><option key={o} value={o}>{caseOriginLabels[o as keyof typeof caseOriginLabels]}</option>)}</select></label>:<><label className="block">対象・参照<input required className={ui.input} value={target} maxLength={500} onChange={e=>setTarget(e.target.value)}/></label><label className="block">事実を確認した日時<input required type="datetime-local" className={ui.input} value={at} onChange={e=>setAt(e.target.value)}/></label></>}
  <label className="block">根拠・理由<textarea required className={ui.input} value={note} maxLength={2000} onChange={e=>setNote(e.target.value)}/></label><p className="text-sm">担当申告として保存します。内部の見積承諾・入金・納品・依頼者受取は変更されません。</p><button className={ui.btnSecondary} disabled={disabled}>担当の記録を保存</button>
 </fieldset></form>;
}
function RevisionForm({view,disabled,save,onDirty}:{view:CaseWorkView;disabled:boolean;save:Save;onDirty:(dirty:boolean)=>void}){
 const [form,setForm,reset]=useCaseDraft(`natori-case-draft/${view.project.id}/revision`,{request:"",message:"",rough:"",note:"",operationId:""},onDirty);
 const {request,message,rough,note}=form;const setRequest=(request:string)=>setForm(v=>({...v,request})),setMessage=(message:string)=>setForm(v=>({...v,message})),setRough=(rough:string)=>setForm(v=>({...v,rough})),setNote=(note:string)=>setForm(v=>({...v,note}));const id=useRef("");
 const open=openCaseRevisions(view.records),handled=!!request;
 return <form className="space-y-3" onSubmit={e=>{e.preventDefault();id.current=form.operationId||id.current||crypto.randomUUID();setForm({...form,operationId:id.current});sessionStorage.setItem(`natori-case-draft/${view.project.id}/${"kind" in form?"record":"revision"}`,JSON.stringify({...form,operationId:id.current}));void save({command:"record",projectId:view.project.id,revision:view.revision,id:id.current,kind:handled?"revision_handled":"revision_open",data:handled?{requestId:request,responseMessageId:message,...(rough?{nextRoughId:rough}:{}),note}:{messageId:message,roughId:rough,note}}).then(ok=>{if(ok){id.current="";reset({request:"",message:"",rough:"",note:"",operationId:""});}});}}><fieldset disabled={disabled} className="space-y-3">
  <label className="block">記録する操作<select className={ui.input} value={request} onChange={e=>{setRequest(e.target.value);setMessage("");setRough("");id.current="";}}><option value="">修正対応待ちを登録</option>{open.map(r=><option key={r.id} value={r.id}>対応済みを記録：{r.data.note}</option>)}</select></label>
  <label className="block">{handled?"対応した担当メッセージ":"修正を求めた依頼者メッセージ"}<select required className={ui.input} value={message} onChange={e=>setMessage(e.target.value)}><option value="">選択してください</option>{view.messages.filter(m=>m.sender===(handled?"staff":"client")).map(m=><option key={m.id} value={m.id}>{m.body} · {caseTime(m.created_at)}</option>)}</select></label>
  <label className="block">{handled?"次のラフ（提示した場合のみ）":"対象のラフ"}<select required={!handled} className={ui.input} value={rough} onChange={e=>setRough(e.target.value)}><option value="">{handled?"新しいラフの指定なし":"選択してください"}</option>{view.messages.filter(m=>m.rough_id).map(m=><option key={m.id} value={m.rough_id!}>{m.body} · {m.client_ok_at?"この版の依頼者OK記録あり":"この版のOK記録なし"}</option>)}</select></label>
  <label className="block">対応内容・理由<textarea required className={ui.input} value={note} maxLength={2000} onChange={e=>setNote(e.target.value)}/></label><button className={ui.btnSecondary} disabled={disabled}>修正対応を記録</button>
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
 useEffect(()=>{mounted.current=true;try{const raw=sessionStorage.getItem(key);if(raw){setFrozen(caseDeliveryRequest.parse(JSON.parse(raw)));setUnknown(true);}}catch{setMessage("保存された操作を確認できません。新しい送信は行わず担当者に確認してください。");setUnknown(true);}return()=>{mounted.current=false;};},[key]);
 useEffect(()=>{onDraftChange(!!frozen||composeDirty);return()=>onDraftChange(false);},[frozen,composeDirty,onDraftChange]);
 const lookup=async()=>{try{const current=await load(frozen?.operationId);setMessage(current.operation?`納品発行は保存済み。メール：${caseWorkNoticeLabel(current.operation.status)}。依頼者受取とは別です。`:"この操作の発行記録は確認できません。結果不明時は新しい操作を作らず、同じ内容で確認してください。");}catch{setMessage("照会できません。結果不明のまま新しい案内を作らないでください。");}};
 const prepare=async()=>{if(lock.current)return;lock.current=true;setBusy(true);try{
  const current=await load();if(!files?.length||files.some(f=>f.state!=="ready")||current.outboundBlocked)throw Error("ファイルまたは未解決処理を確認してください。");
  const now=new Date().toISOString(),expiry=days?new Date(Date.parse(now)+days*86400000).toISOString():current.release?.expiresAt??new Date(Date.parse(now)+DELIVERY_VALID_DAYS*86400000).toISOString();
  const value=caseDeliveryRequest.parse({projectId:p.id,operationId:crypto.randomUUID(),revision:current.revision,to:to.trim(),subject:draft.subject,body:draft.body,fileIds:current.files.map(f=>f.id),files:current.files,preparedAt:now,expiresAt:expiry,...(days?{extension:{days,reason}}:{})});
  sessionStorage.setItem(key,JSON.stringify(value));if(mounted.current){setFrozen(value);setUnknown(false);setMessage("内容を固定しました。まだ発行・送信していません。");}
 }catch(e){setMessage(e instanceof Error?e.message:"準備できません。");}finally{lock.current=false;setBusy(false);}};
 const submit=async()=>{if(lock.current||!frozen)return;lock.current=true;setBusy(true);setUnknown(true);
  try{const response=await mutateCaseWork({command:"delivery",request:frozen});if(!mounted.current)return;
   if(response.kind==="ok"||response.kind==="recorded"){setMessage(`納品発行は保存済み。メール：${caseWorkNoticeLabel(response.notificationStatus??"")}。依頼者受取とは別です。`);onChanged();await load(frozen.operationId);}
   else setMessage(`実行結果：${response.kind}。最新状態と同じ操作の記録を確認してください。`);
  }catch(e){if(mounted.current)setMessage(e instanceof Error?e.message:"結果未確認");}finally{lock.current=false;if(mounted.current)setBusy(false);}
 };
 return <section className={card}><h3 className="font-semibold">最終ファイル・納品案内</h3><DeliveryFilesManager projectId={p.id} folder="final" onFilesChange={setFiles} workspaceSafe/>
  <p className="text-sm">ファイル保存 → 内容確認 → 納品発行・送信受付 → 結果照会を区別します。依頼者の受取は依頼者専用ページで行います。</p>
  {view.release?<p>発行済み：{caseTime(view.release.publishedAt)} / 保存期限：{caseTime(view.release.expiresAt)} / {p.deliveryAcceptedAt?"サイト上の依頼者受取記録あり":"サイト上の受取記録なし"}</p>:null}
  {frozen?<div className="space-y-3 rounded-xl border border-pink-200 bg-pink-50 p-3"><h4 className="font-semibold">送信前確認（固定した内容）</h4><p>宛先：{frozen.to}</p><p>対象：{p.title} / {frozen.extension?`期限延長 ${frozen.extension.days}日：${frozen.extension.reason}`:view.release?"発行済み納品の案内":"初回の納品発行"}</p><p>保存期限：{caseTime(frozen.expiresAt)}</p><ul>{frozen.fileIds.map(id=><li key={id}>{frozen.files.find(f=>f.id===id)?.fileName??id} · {frozen.files.find(f=>f.id===id)?.sizeBytes} bytes · 保存確認：{fileTime(frozen.files.find(f=>f.id===id)?.verifiedAt)}</li>)}</ul><p>{frozen.subject}</p><pre className="whitespace-pre-wrap break-words text-sm">{frozen.body}</pre>
   <button className={ui.btnPrimary} disabled={disabled||busy||unknown} onClick={()=>void submit()}>この内容で納品発行・送信受付</button>
   <button className={ui.btnSecondary} disabled={busy} onClick={()=>void lookup()}>同じ操作の結果を照会</button>
   {unknown?<><p>結果確認中は新しい発行を行いません。記録がない場合も未実行と断定していません。</p>
    {view.operation&&["sent","failed"].includes(view.operation.status)?<button className={ui.btnSecondary} disabled={busy} onClick={()=>{sessionStorage.removeItem(key);setFrozen(null);setUnknown(false);setMessage("確認済みの操作を閉じました。次の案内は改めて内容を準備・確認します。");}}>確認済みの操作を閉じる</button>:null}
    {!view.operation?<button className={ui.btnSecondary} disabled={disabled||busy} onClick={()=>void(async()=>{const current=await load(frozen.operationId);if(current.operation){setMessage("保存済みの操作が見つかりました。結果を照会してください。");return;}const now=new Date().toISOString(),expiry=frozen.extension?new Date(Date.parse(now)+frozen.extension.days*86400000).toISOString():current.release?.expiresAt??new Date(Date.parse(now)+DELIVERY_VALID_DAYS*86400000).toISOString();const next={...frozen,revision:current.revision,preparedAt:now,expiresAt:expiry};sessionStorage.setItem(key,JSON.stringify(next));setFrozen(next);setUnknown(false);setMessage("同じ操作IDの確認内容を更新しました。新しい操作IDや別の送信は作成していません。");})().catch(()=>setMessage("再確認できません。実行せず照会してください。"))}>同じ操作の確認内容を更新</button>:null}
   </>:<button className={ui.btnSecondary} disabled={busy} onClick={()=>{sessionStorage.removeItem(key);setFrozen(null);setMessage("");}}>発行前の確認を取り消す</button>}
  </div>:<div className="space-y-3"><label className="block">納品案内の宛先<input className={ui.input} type="email" value={to} onChange={e=>setTo(e.target.value)}/></label><label className="block">納品案内の件名<input className={ui.input} value={draft.subject} onChange={e=>setDraft({...draft,subject:e.target.value})}/></label><label className="block">納品案内の本文<textarea className={ui.input} rows={6} value={draft.body} onChange={e=>setDraft({...draft,body:e.target.value})}/></label>
   {view.release?<><label className="block">保存期限の扱い<select className={ui.input} value={days} onChange={e=>setDays(Number(e.target.value))}><option value={0}>現在の期限のまま</option>{DELIVERY_EXTENSION_DAYS.filter(()=>Date.parse(view.release!.expiresAt)<=Date.now()).map(d=><option key={d} value={d}>{d}日へ延長（旧リンクは停止）</option>)}</select></label>{days?<label className="block">延長理由<input className={ui.input} value={reason} maxLength={200} onChange={e=>setReason(e.target.value)}/></label>:null}</>:null}
   <button className={ui.btnSecondary} disabled={disabled||busy||unknown} onClick={()=>void prepare()}>納品の送信前確認へ</button></div>}
  {message?<p role="status" className="whitespace-pre-wrap text-sm">{message}</p>:null}
 </section>;
}
