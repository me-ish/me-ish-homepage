"use client";
import { useCallback, useEffect, useRef, useState, type AnchorHTMLAttributes, type Key, type ReactNode } from "react";
import { natoriAdminUi as ui } from "../../constants/adminUi";
import { CASE_SECTIONS, type CaseEntry, type CaseWorkspaceRecord } from "../../types/caseWorkspace";
import { caseKnown, caseTime, caseTargetSection, CASE_SECTION_LABELS, caseWaitLine, deriveCaseGuidance, observationLabel } from "../../lib/caseWorkspacePresentation";
import { CASE_NOTICE_PURPOSES, caseNoticeLabel, matchesCaseEntry } from "../../lib/caseWorkspaceEntries";
import { caseWorkspaceHref, parseCaseWorkspaceLocation, type CaseWorkspaceLocation } from "../../lib/caseWorkspaceNavigation";
import {publicAcceptanceTarget} from "@/lib/caseAcceptanceEnvironment";
import {CaseRegistration} from "./CaseRegistration";
import { CaseWorkPanel } from "./CaseWorkPanel";
import { CaseWorkspaceSections } from "./CaseWorkspaceSections";
import { CaseWorkspaceLoadError } from "../../types/caseWorkspaceLoad";
import { CaseMonthPicker } from "./CaseMonthPicker";
import {CasePersonalSchedule} from "./CasePersonalSchedule";
import {CaseNoticePages} from "./CaseNoticePages";
import {loadCaseNoticeIndex,loadCasePersonalEvents} from "../../data/supabaseCaseEntries";
import type {CaseNoticeIndex,CasePersonalEvent} from "../../types/caseEntryIndex";
import {notificationPurposeName} from "../../lib/notificationLabels";
import {loadCasePlanning} from "../../data/supabaseCaseScreen";
import type {CasePlanning} from "../../lib/caseScreenContext";
import {casePlanProject,casePlannedBars,casePriority,CASE_PLAN_STAGE_LABELS} from "../../lib/casePlanning";
import {getDeliveryPlanMeta} from "../../lib/deliveryPlans";
import {CaseIntakePanel} from "./CaseIntakePanel";
import {CaseHistoryPanel} from "./CaseHistoryPanel";
import {CaseWorkspaceUtilities} from "./CaseWorkspaceUtilities";

export type CasePreviewLoader = (mode: CaseWorkspaceLocation["mode"], signal: AbortSignal) => Promise<readonly CaseWorkspaceRecord[]>;
const entries: Record<CaseEntry,string> = { today: "今日", cases: "案件", schedule: "予定", notifications: "通知" };
const listPositionKey = (nav: CaseWorkspaceLocation) => JSON.stringify([nav.entry,nav.query,nav.filter,nav.date,nav.month,nav.page,nav.noticePage,nav.source,nav.sort,nav.intakeFilter]);

/** Shared read-only workspace. Fixture controls are absent from the application variant. */
export function CaseWorkspacePreview({ load, loadDetail, application=false, entryTools=false,personalEventsEnabled=true,readOnly=false,initialSearch, today="2026-10-20", basePath="/" }: {
  load: CasePreviewLoader; loadDetail?:(id:string,signal:AbortSignal)=>Promise<CaseWorkspaceRecord>; application?: boolean; entryTools?:boolean;personalEventsEnabled?:boolean;readOnly?:boolean;initialSearch?: string; today?: string; basePath?: string;
}) {
  const [nav,setNav]=useState(()=>parseCaseWorkspaceLocation(initialSearch ?? (typeof window === "undefined" ? "" : window.location.search),today));
  const selectedNotificationId=nav.noticeId&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(nav.noticeId)?nav.noticeId:undefined;
  const initialLocation=useRef(nav);
  useEffect(()=>{if(application&&entryTools)window.history.replaceState(window.history.state,"",caseWorkspaceHref(initialLocation.current,window.location.pathname));},[application,entryTools]);
  const [records,setRecords]=useState<readonly CaseWorkspaceRecord[]|null>(null);
  const [pending,setPending]=useState(true), [failed,setFailed]=useState(false), [reload,setReload]=useState(0);
  const [accessError,setAccessError]=useState<"unauthorized"|"scope_unavailable"|null>(null);
  const [hasWorkDraft,setHasDraft]=useState(false),[hasEventDraft,setHasEventDraft]=useState(false);
  const [hasRegistrationDraft,setHasRegistrationDraft]=useState(false);
  const [hasIntakeDraft,setHasIntakeDraft]=useState(false),[hasUtilityDraft,setHasUtilityDraft]=useState(false);
  const hasDraft=hasWorkDraft||hasEventDraft||hasRegistrationDraft||hasIntakeDraft||hasUtilityDraft;
  const [plans,setPlans]=useState<CasePlanning|null>(null),[plansReady,setPlansReady]=useState(false);
  const [detail,setDetail]=useState<{id:string;record:CaseWorkspaceRecord|null;pending:boolean;error:"not_found"|"unavailable"|null}|null>(null);
  const accessEpoch=useRef(0);
  const rejectAccess=useCallback((kind:"unauthorized"|"scope_unavailable"="unauthorized")=>{accessEpoch.current++;setDetail(null);setRecords(null);setPersonalEvents(null);setNoticeIndex(null);setPlans(null);setFailed(true);setAccessError(kind);setPending(false);},[]);
  const [personalEvents,setPersonalEvents]=useState<readonly CasePersonalEvent[]|null>(null),[eventsReady,setEventsReady]=useState(false);
  const [noticeIndex,setNoticeIndex]=useState<CaseNoticeIndex|null>(null),[noticesReady,setNoticesReady]=useState(false);
  useEffect(()=>{if(!hasDraft)return;const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};window.addEventListener("beforeunload",guard);return()=>window.removeEventListener("beforeunload",guard);},[hasDraft]);
  useEffect(()=>{const pop=()=>{const next=parseCaseWorkspaceLocation(window.location.search,today);if(hasDraft&&(next.projectId!==nav.projectId||hasUtilityDraft&&next.utility!==nav.utility||hasEventDraft&&(next.date!==nav.date||next.entry!==nav.entry))&&!window.confirm("入力中または結果確認中の内容があります。画面から移動しますか？")){window.history.pushState(null,"",caseWorkspaceHref(nav,basePath));return;}setNav(next);};window.addEventListener("popstate",pop);return()=>window.removeEventListener("popstate",pop);},[today,hasDraft,hasEventDraft,hasUtilityDraft,nav,basePath]);
  const heading=useRef<HTMLHeadingElement>(null);
  const listPositions=useRef(new Map<string,number>());
  const entryPositions=useRef(new Map<CaseEntry,CaseWorkspaceLocation>());
  const restoredFocus=useRef<string>();

  useEffect(()=>{
    if(!application)return;
    const refresh=()=>{if(document.visibilityState!=="hidden")setReload(value=>value+1);};
    window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",refresh);
    return()=>{window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);};
  },[application]);
  useEffect(()=>{
    const controller=new AbortController(),epoch=accessEpoch.current;let active=true,authRejected=false;
    setPending(true);setEventsReady(false);setNoticesReady(false);setPlansReady(false);
    const observe=<T,>(promise:Promise<T>)=>promise.catch((error:unknown)=>{
      if(active&&error instanceof CaseWorkspaceLoadError&&(error.kind==="unauthorized"||error.kind==="scope_unavailable")){
        authRejected=true;controller.abort();rejectAccess(error.kind);
      }
      throw error;
    });
    void Promise.allSettled([
      observe(load(application?"normal":nav.mode,controller.signal)),
      application&&entryTools&&personalEventsEnabled?observe(loadCasePersonalEvents(controller.signal)):Promise.resolve(null),
      application&&entryTools?observe(loadCaseNoticeIndex(controller.signal)):Promise.resolve(null),
      application&&entryTools?observe(loadCasePlanning(controller.signal)):Promise.resolve(null),
    ]).then(([main,events,notices,planning])=>{
      if(!active||authRejected||epoch!==accessEpoch.current)return;
      const authError=[main,events,notices].find(result=>result.status==="rejected"&&result.reason instanceof CaseWorkspaceLoadError&&(result.reason.kind==="unauthorized"||result.reason.kind==="scope_unavailable"));
      if(authError?.status==="rejected"){
        setRecords(null);setPersonalEvents(null);setNoticeIndex(null);setFailed(true);setAccessError(authError.reason.kind);setPending(false);return;
      }
      if(main.status==="fulfilled"){setRecords(main.value);setFailed(false);setAccessError(null);}else setFailed(true);
      if(events.status==="fulfilled"&&events.value!==null){setPersonalEvents(events.value);setEventsReady(true);}
      if(notices.status==="fulfilled"&&notices.value!==null){setNoticeIndex(notices.value);setNoticesReady(true);}
      if(planning.status==="fulfilled"&&planning.value!==null){setPlans(planning.value);setPlansReady(true);}else setPlans(null);
      setPending(false);
    });
    return()=>{active=false;controller.abort();};
  },[load,nav.mode,reload,application,entryTools,personalEventsEnabled,rejectAccess]);
  useEffect(()=>{
    if(!loadDetail||!nav.projectId){setDetail(null);return;}
    const id=nav.projectId,controller=new AbortController(),epoch=accessEpoch.current;
    setDetail(previous=>({id,record:previous?.id===id?previous.record:null,pending:true,error:null}));
    void loadDetail(id,controller.signal).then(record=>{
      if(!controller.signal.aborted&&epoch===accessEpoch.current){if(record.id!==id)throw Error("scope_mismatch");setDetail({id,record,pending:false,error:null});setAccessError(null);}
    }).catch((error:unknown)=>{
      if(controller.signal.aborted||epoch!==accessEpoch.current)return;
      if(error instanceof CaseWorkspaceLoadError&&(error.kind==="unauthorized"||error.kind==="scope_unavailable")){rejectAccess(error.kind);return;}
      setDetail(previous=>({id,record:error instanceof CaseWorkspaceLoadError&&error.kind==="not_found"?null:previous?.id===id?previous.record:null,pending:false,error:error instanceof CaseWorkspaceLoadError&&error.kind==="not_found"?"not_found":"unavailable"}));
    });
    return()=>controller.abort();
  },[loadDetail,nav.projectId,reload,rejectAccess]);
  const move=(next:CaseWorkspaceLocation,replace=false)=>{
    if(nav.entry===next.entry&&(nav.query!==next.query||nav.filter!==next.filter||nav.date!==next.date||nav.month!==next.month||nav.sort!==next.sort||nav.source!==next.source||nav.intakeFilter!==next.intakeFilter))next={...next,page:1,noticePage:1};
    if(hasDraft&&(nav.projectId!==next.projectId||hasUtilityDraft&&next.utility!==nav.utility||hasEventDraft&&(next.date!==nav.date||next.entry!==nav.entry))&&!window.confirm("入力中または結果確認中の内容があります。画面から移動しますか？"))return;
    if(nav.entry!==next.entry)entryPositions.current.set(nav.entry,nav);
    if(!nav.projectId&&next.projectId)listPositions.current.set(listPositionKey(nav),window.scrollY);
    const href=caseWorkspaceHref(next,basePath);window.history[replace?"replaceState":"pushState"](null,"",href);setNav(parseCaseWorkspaceLocation(window.location.search,today));
  };
  const link=(next:CaseWorkspaceLocation,children:ReactNode,className:string,extra:AnchorHTMLAttributes<HTMLAnchorElement>&{key?:Key}={})=>{
    const {key,...attributes}=extra;
    return <a key={key} {...attributes} href={caseWorkspaceHref(next,basePath)} className={className} onClick={event=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();move(next);
  }}>{children}</a>;};
  const rows=records??[], selected=loadDetail?(detail?.id===nav.projectId&&!accessError?detail.record??undefined:undefined):rows.find(row=>row.id===nav.projectId);
  const selectedPending=loadDetail?!!detail?.pending:pending,selectedFailed=loadDetail?!!detail?.error:failed;
  const positionKey=listPositionKey(nav);
  const focusKey=JSON.stringify([nav.projectId,nav.section,nav.entry,nav.selectedId,nav.noticeId,selected?.id,nav.projectId?false:records!==null]);
  useEffect(()=>{
    // Search/filter/date edits must keep focus in the field. Restore only when
    // entering/leaving a case, switching entry/section, or receiving initial data.
    if(restoredFocus.current===focusKey)return;
    restoredFocus.current=focusKey;
    if(nav.projectId)heading.current?.focus();
    else if(nav.selectedId){
      (document.getElementById(`index-notice-${nav.noticeId}`)??document.getElementById(`notice-${nav.noticeId}`)??document.getElementById(`case-${nav.selectedId}`))?.focus({preventScroll:true});
      const position=listPositions.current.get(positionKey);
      if(position!==undefined)window.scrollTo(0,position);
    }
  },[nav.projectId,nav.section,nav.entry,nav.selectedId,nav.noticeId,focusKey,positionKey]);
  const guidance=selected?deriveCaseGuidance(selected):null;
  const selectedNotice=selected&&nav.noticeId?caseKnown(selected.model.facts.notifications)?.find(n=>n.id===nav.noticeId):undefined;
  const indexNotice=selected&&nav.noticeId?noticeIndex?.items.find(n=>n.id===nav.noticeId&&n.projectId===selected.id):undefined;
  const visible=rows.filter(row=>matchesCaseEntry(row,nav,plansReady?plans:null,today)).sort((a,b)=>nav.sort==="due"?(a.registeredDueDate??"9999").localeCompare(b.registeredDueDate??"9999")||a.id.localeCompare(b.id):nav.sort==="priority"?(casePriority(b,plansReady?plans:null,today)?.score??-1)-(casePriority(a,plansReady?plans:null,today)?.score??-1)||a.id.localeCompare(b.id):0);
  const pages=Math.max(1,Math.ceil(visible.length/50)),pageRows=visible.slice((nav.page-1)*50,nav.page*50);
  const entryLocation=(entry:CaseEntry):CaseWorkspaceLocation=>({...(entry===nav.entry?nav:entryPositions.current.get(entry)??{...nav,query:"",filter:"all",selectedId:null,noticeId:null,page:1,noticePage:1}),entry,utility:"none",projectId:null,section:"overview"});
  const open=(id:string):CaseWorkspaceLocation=>({...nav,utility:"none",projectId:id,selectedId:id,noticeId:null,historyPage:1,section:nav.source==="estimate"?"transaction":nav.entry==="notifications"?deriveCaseGuidance(rows.find(r=>r.id===id)!).primary.section:"overview"});
  const back={...nav,projectId:null,section:"overview" as const};
  const entryTitle=nav.entry==="schedule"?`${nav.date}の予定`:nav.entry==="cases"?"案件一覧":nav.entry==="notifications"?"案内・通知を確認する案件":"今日、確認すること";
  return <div data-natori-admin className="min-h-screen bg-[#F7F7F8] pb-24 text-zinc-900 lg:pb-6">
    {!application||readOnly?<div className="border-b border-pink-100 bg-pink-50 px-4 py-2 text-center text-xs leading-5 text-pink-950">{readOnly?"操作を停止しています。確定した記録と未確認の処理を読み取れます。":"架空データの表示確認用 · 実際の操作には未接続"}</div>:null}
    <header className="border-b border-zinc-200 bg-white"><div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
      <p className="text-xl font-semibold tracking-tight">natori<span className="ml-3 text-xs font-normal text-zinc-500">案件ワークスペース</span></p>
      {application&&entryTools?<div className="flex flex-wrap gap-3">{link({...nav,utility:"settings"},"設定・管理機能",ui.btnSecondary)}{link({...nav,utility:"estimate"},"概算の下書き",ui.btnSecondary)}</div>:null}
      <nav aria-label="主な入口" className="hidden items-center gap-2 lg:flex">{(Object.keys(entries) as CaseEntry[]).map(entry=>link(entryLocation(entry),entries[entry],
        `${ui.btnSecondary} ${nav.entry===entry?"border-pink-300 bg-pink-50 text-pink-900":""}`,{"aria-current":nav.entry===entry?"page":undefined,key:entry}))}</nav>
      {!application?<details className="text-xs text-zinc-600"><summary className="cursor-pointer rounded-lg p-2 focus-visible:outline">表示の検証</summary><label className="mt-2 block">架空データの取得状態
        <select className="ml-2 rounded border p-2" aria-label="架空データの取得状態" value={nav.mode} onChange={e=>move({...nav,mode:e.target.value as CaseWorkspaceLocation["mode"]})}>
          <option value="normal">通常</option><option value="partial">一部取得失敗</option><option value="failed">最新読取失敗</option></select></label></details>:null}
    </div></header>
    <div className="mx-auto max-w-[1440px] px-4 pt-4 sm:px-6">
      {application&&entryTools&&nav.utility!=="none"?<div className="mb-5">{link({...nav,utility:"none"},"← 元の案件画面へ戻る",`${ui.btnLink} mb-4`)}{!accessError?<CaseWorkspaceUtilities key={nav.utility} mode={nav.utility} readOnly={readOnly} onDraftChange={setHasUtilityDraft} onAccessRejected={rejectAccess}/>:<p role="alert">認証を確認できないため設定の表示を消去しました。再取得して確認してください。</p>}</div>:null}
      {failed?<div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><p>{accessError==="unauthorized"?"認証を確認できません。案件の表示を消去しました。ログイン状態を確認してください。":accessError==="scope_unavailable"?"管理対象の設定を確認できません。案件の表示を消去しました。":loadDetail&&nav.projectId?"案件一覧を取得できません。対象の詳細は別に確認します。":`最新情報を取得できません。${records?"前回確認した記録を表示しています。":"案件データはまだ取得できていません。"}`}</p>
        <button type="button" className={ui.btnSecondary} disabled={pending} onClick={()=>setReload(v=>v+1)}>表示を再取得</button></div>:null}
      <div role="status" className="sr-only">{pending?"表示を読み取り中":failed?"最新の読み取りに失敗":"表示を取得しました"}</div>
      {entryTools&&!pending&&!failed&&(personalEventsEnabled&&!eventsReady||!noticesReady)?<button type="button" className={`${ui.btnSecondary} mb-4`} onClick={()=>setReload(v=>v+1)}>予定・通知を再取得</button>:null}
      <div className={`${nav.utility!=="none"?"hidden":"grid"} gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]`}>
        <aside aria-label={entryTitle} className={`${nav.projectId?"hidden lg:block":""} min-w-0`}>
          {application&&entryTools&&personalEventsEnabled&&!publicAcceptanceTarget(true)&&!readOnly?<CaseRegistration today={today} onChanged={()=>setReload(v=>v+1)} onDraftChange={setHasRegistrationDraft} onOpen={id=>{const next={...nav,entry:"cases" as const,projectId:id,selectedId:id,section:"overview" as const};move(next);setReload(v=>v+1);}}/>:null}
          <div className="mb-4 flex items-center justify-between"><h1 className="text-xl font-semibold">{entryTitle}</h1><span className="text-xs text-zinc-500">{records===null?"件数未確認":`${pending||failed?"前回確認：":""}${visible.length}案件`}</span></div>
          <div className="mb-4 space-y-3"><label className="block text-xs font-semibold text-zinc-600">案件を検索<input type="search" value={nav.query} onChange={e=>move({...nav,query:e.target.value},true)} placeholder="案件名・依頼者" className="mt-1 block h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm" /></label>
            <label className="block text-xs font-semibold text-zinc-600">案件の並び<select className="mt-1 h-11 w-full rounded-xl border px-3" value={nav.sort} onChange={e=>move({...nav,sort:e.target.value as CaseWorkspaceLocation["sort"]})}><option value="default">受付順</option><option value="due">納期が近い順</option><option value="priority">急ぎの順</option></select></label>
            {nav.source!=="all"||nav.intakeFilter!=="all"?<><p className="text-xs">{nav.source==="inquiries"?"問い合わせからの入口":nav.source==="estimate"?"見積からの入口":"問い合わせ条件"} · 状態は共通の事実で判定します。</p><label className="block text-xs font-semibold">問い合わせの絞り込み<select className={ui.input} value={nav.intakeFilter} onChange={e=>move({...nav,intakeFilter:e.target.value as CaseWorkspaceLocation["intakeFilter"]})}><option value="all">すべて</option><option value="attention">対応・確認が必要</option><option value="rough-ok">ラフOK・担当確認前</option><option value="ended">見送り・保管</option><option value="inquiry">相談受付</option><option value="estimating">見積下書き</option><option value="quoted">見積の記録あり</option><option value="awaiting_payment">案内送信後の支払い待ち</option></select></label><p className="text-xs">旧URLの工程条件もこの事実による絞り込みへ対応します。手動進捗だけでは支払い待ちにしません。</p></>:null}
            <label className="block text-xs font-semibold text-zinc-600">対応で絞り込む<select value={nav.filter} onChange={e=>move({...nav,filter:e.target.value as CaseWorkspaceLocation["filter"]})} className="mt-1 h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm">
              <option value="all">すべて</option><option value="staff">自分の番</option><option value="client">お客さんの番</option><option value="completed">受取・完了済み</option></select></label>
            {nav.entry==="schedule"?<><CaseMonthPicker nav={nav} records={rows} available={!pending&&!failed&&records!==null} onChange={move} plans={plansReady?plans:null} today={today} events={entryTools&&personalEventsEnabled?eventsReady?personalEvents:null:undefined}/><label className="block text-xs font-semibold text-zinc-600">予定日<input type="date" value={nav.date} onChange={e=>{if(e.target.value)move({...nav,date:e.target.value,month:e.target.value.slice(0,7)});}} className="mt-1 h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm" /></label></>:null}
          </div>
          {nav.entry==="schedule"?<p className="mb-4 text-xs leading-6 text-zinc-600">登録納期と計算上の工程予定です。合意済みの期限や実際の着手・完了とは別です。{application&&entryTools&&!plansReady?"工程予定は未取得です。登録納期だけを表示しています。":application&&entryTools&&rows.some(r=>!casePlanProject(r,plans))?"一部案件の工程予定は最新状態との対応が未確認です。予定なしとは断定していません。":""}</p>:null}
          {nav.entry==="schedule"&&application&&entryTools?(personalEventsEnabled?<CasePersonalSchedule key={nav.date} date={nav.date} events={personalEvents} available={eventsReady} readOnly={readOnly} onChanged={()=>setReload(v=>v+1)} onDraftChange={setHasEventDraft}/>:<p className="mb-4 text-xs text-amber-900">この検証設定では個人予定は対象外です。</p>):null}
          {nav.entry==="notifications"?<><p className="mb-4 text-xs leading-6 text-zinc-600">案件内の案内と通知です。通知がまだない案内待ちも含みます。受付・到達・入金・受取は別の記録です。</p>{entryTools?<CaseNoticePages index={noticeIndex} available={noticesReady&&!pending&&!failed&&records!==null} records={rows} nav={nav} href={next=>caseWorkspaceHref(next,basePath)} onMove={move}/>:null}</>:null}
          <div className="space-y-3">{pageRows.map(row=>{const g=deriveCaseGuidance(row),active=nav.projectId===row.id;return <div key={row.id}>{link(open(row.id),<>
            <p className="mb-1 text-xs text-zinc-500">{row.clientLabel}</p><p className="font-semibold leading-6">{row.title}</p><p className="mt-3 text-sm text-zinc-700">{g.status}</p>
            {g.waits[0]?<p className={`mt-2 text-xs leading-5 ${g.waits[0].who==="staff"?"font-semibold text-zinc-900":"text-zinc-600"}`}>{caseWaitLine(g.waits[0])}</p>:null}
            {nav.sort==="priority"?<p className="mt-2 text-xs">優先理由：{casePriority(row,plansReady?plans:null,today)?.reasons.join(" / ")??"計画の対応を確認できません"}</p>:null}
            {nav.entry==="schedule"?<p className="mt-2 text-xs">{row.registeredDueDate===nav.date?"登録納期当日":"制作工程の予定日"}{casePlannedBars(row,plansReady?plans:null,today).filter(b=>b.startISO<=nav.date&&b.endISO>=nav.date).map(b=>` · ${CASE_PLAN_STAGE_LABELS[b.stage]}予定 ${b.startISO}〜${b.endISO}`).join("")}{(()=>{const p=casePlanProject(row,plansReady?plans:null);return p&&getDeliveryPlanMeta(p.deliveryPlan).isRush?` · ${getDeliveryPlanMeta(p.deliveryPlan).shortLabel}`:"";})()}</p>:null}
            <p className="mt-4 flex justify-between text-xs font-semibold text-pink-800"><span>{active?"選択中":row.id===nav.selectedId?"前に開いた案件":"案件を開く"}</span><span aria-hidden="true">→</span></p>
          </>,`${ui.card} block ${active?"border-pink-400 ring-1 ring-pink-200":"hover:border-pink-300"} ${ui.focusRing}`,{id:`case-${row.id}`,"aria-current":active?"page":undefined})}
          {nav.entry==="notifications"?<div className="space-y-2 px-2 pt-2">{row.model.facts.notifications.state!=="ready"?<p className="text-xs text-amber-800">{observationLabel(row.model.facts.notifications)}</p>:null}
            {caseKnown(row.model.facts.notifications)?.filter(notice=>!entryTools||!noticeIndex?.items.some(n=>n.id===notice.id)).map(notice=>link({...open(row.id),noticeId:notice.id,section:caseTargetSection(notice.target.kind)},<><span className="block font-semibold">{CASE_NOTICE_PURPOSES[notice.purpose]} · {caseNoticeLabel(notice)}</span><span className="block text-xs">{caseTime(notice.recordedAt)}{notice.attemptNo>1?` · ${notice.attemptNo}回目`:""} · 案件を開く</span></>,`block rounded-lg border border-zinc-200 bg-white p-3 text-sm ${ui.focusRing}`,{key:notice.id,id:`notice-${notice.id}`}))}
            {row.model.facts.notifications.state==="ready"&&!row.model.facts.notifications.value.length?<p className="text-xs text-zinc-600">まだメールは送っていません</p>:null}
          </div>:null}</div>;})}
            {pending && records===null?<p className="p-4 text-sm text-zinc-600">案件データを取得しています…</p>:!failed&&visible.length===0?<p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">この表示条件に合う案件はありません。</p>:null}
            {!pending&&!failed&&records!==null&&(pages>1||nav.page>1)?<nav aria-label="案件のページ" className="flex flex-wrap items-center gap-2 text-xs"><span>{nav.page} / {pages}ページ</span><button className={ui.btnSecondary} disabled={nav.page<=1} onClick={()=>move({...nav,page:nav.page-1})}>前の案件</button><button className={ui.btnSecondary} disabled={nav.page>=pages} onClick={()=>move({...nav,page:nav.page+1})}>次の案件</button>{nav.page>pages?<button className={ui.btnSecondary} onClick={()=>move({...nav,page:1})}>一覧が変わりました。先頭へ</button>:null}</nav>:null}
          </div>
        </aside>
        <main className={`${!nav.projectId?"hidden lg:block":""} min-w-0`}>
          {loadDetail&&nav.projectId&&detail?.error&&detail.error!=="not_found"?<p role="alert" className="mb-3 text-sm text-amber-900">対象案件の最新版を取得できません。表示を再取得してください。</p>:null}
          {selected&&guidance?<>
            <div className="mb-4">{link(back,`← ${nav.entry==="schedule"?`${nav.date}の予定`:entries[nav.entry]}へ戻る`,`${ui.btnLink} min-h-11`)}</div>
            <section className={`${ui.card} mb-5`} aria-label="案件の共通案内">
              <p className="mb-1 text-xs text-zinc-500">{selected.clientLabel} · 納期 {selected.registeredDueDate??"未登録"}</p>
              <h1 ref={heading} tabIndex={-1} className="text-[22px] font-semibold leading-9 tracking-tight outline-none sm:text-2xl">{selected.title}</h1>
              {nav.noticeId?<aside aria-label="選択した通知" className="mt-3 rounded-xl border border-zinc-200 p-3 text-sm">{selectedNotice?<><p className="font-semibold">{CASE_NOTICE_PURPOSES[selectedNotice.purpose]} · {caseNoticeLabel(selectedNotice)}</p><p className="break-all text-xs">通知：{selectedNotice.id} · 対象：{selectedNotice.target.kind} / {selectedNotice.target.id} · 条件：{selectedNotice.target.revision}</p><p className="mt-1 text-xs">{selected.model.facts.notifications.state!=="ready"?"前回確認した通知です。":"保存された通知です。"}過去の版・条件の場合があります。現在の案件の記録と分けて確認します。受付は業務の完了を示しません。</p></>:indexNotice?<><p>{notificationPurposeName(indexNotice.purpose)} · 通知一覧の記録</p><p className="break-all text-xs">通知：{indexNotice.id} · 対象参照：{indexNotice.targetId??"未確認"} · 条件：{indexNotice.targetRevision??"未確認"}</p><p className="text-xs">案件内の系列全体は未確認です。この一覧だけでは業務結果の確定や再送許可を出しません。</p></>:"選択した通知の記録は、この取得結果では確認できません。別の通知で補っていません。"}</aside>:null}
              <p className="mt-3 text-sm font-semibold text-pink-900">{selectedFailed||selectedPending?"前回確認した段階：":"いまの段階："}{guidance.status}</p>
              <dl className="my-4 grid gap-2 sm:grid-cols-3">{guidance.facts.filter(f=>f.label!=="支払リンク"&&(f.label!=="受取"||!!caseKnown(selected.display.receipt))).map(fact=><div key={fact.label} className="flex items-baseline justify-between gap-2 rounded-xl bg-zinc-50 p-3 sm:block"><dt className="shrink-0 text-xs text-zinc-500">{fact.label}</dt><dd className="text-sm font-semibold leading-6 sm:mt-1">{fact.value}</dd></div>)}</dl>
              <div className="rounded-xl border border-pink-100 bg-pink-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold text-pink-900">{selectedFailed?"前回確認時の次にやること":"次にやること"}</p>
                <p className="mt-1 text-sm font-semibold leading-6">{guidance.waits[0]?caseWaitLine(guidance.waits[0]):"いまやることはありません"}</p></div>
                {nav.section===guidance.primary.section?<p className="text-xs font-semibold text-pink-900">この下で進められます</p>:link({...nav,section:guidance.primary.section},guidance.primary.label,ui.btnPrimary)}</div></div>
              {selectedNotificationId&&nav.section!=="transaction"?<p className="mt-3 text-sm">{link({...nav,section:"transaction"},"この通知の状態・復旧を確認",ui.btnLink)}</p>:null}
            {guidance.waits.length>1?<ul aria-label="ほかにやること" className="mt-3 space-y-1">{guidance.waits.slice(1).map(wait=><li key={wait.key} className="text-sm">{link({...nav,section:wait.section},caseWaitLine(wait),ui.btnLink)}</li>)}</ul>:null}
              {guidance.unknown.filter(item=>item.startsWith("要確認：")).map(item=><p key={item} className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{item}</p>)}
              <p className="mt-4 text-xs leading-5 text-zinc-500">最終読取 {caseTime(selected.model.checkedAt)}</p>
            </section>
            <label className="mb-5 block text-xs font-semibold text-zinc-600 sm:hidden">案件の領域<select value={nav.section} onChange={e=>move({...nav,section:e.target.value as CaseWorkspaceLocation["section"]})} className="mt-1 h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm">{CASE_SECTIONS.map(section=><option key={section} value={section}>{CASE_SECTION_LABELS[section]}</option>)}</select></label>
            <nav aria-label="案件の領域" className="mb-5 hidden grid-cols-5 gap-1 rounded-2xl border border-zinc-200 bg-white p-1 sm:grid">{CASE_SECTIONS.map(section=>link({...nav,section},CASE_SECTION_LABELS[section],
              `flex min-h-11 items-center justify-center rounded-xl px-2 text-sm font-semibold ${ui.focusRing} ${nav.section===section?"bg-zinc-900 text-white":"text-zinc-600 hover:bg-zinc-100"}`,{key:section,"aria-current":nav.section===section?"page":undefined}))}</nav>
            <h2 className="mb-4 text-lg font-semibold">{CASE_SECTION_LABELS[nav.section]}</h2><CaseWorkspaceSections selectedNotificationId={selectedNotificationId} record={selected} section={nav.section} application={application} readOnly={readOnly} onChanged={()=>setReload(v=>v+1)}/>
            {application&&entryTools?<CaseHistoryPanel key={`history-${selected.id}`} projectId={selected.id} section={nav.section} refreshKey={selected.model.fingerprint} page={nav.historyPage??1} onNotice={id=>move({...nav,noticeId:id,section:"transaction"})} onPage={page=>move({...nav,historyPage:page})} onAccessRejected={rejectAccess}/>:null}
            {application&&entryTools?<CaseIntakePanel key={`intake-${selected.id}`} projectId={selected.id} section={nav.section} readOnly={readOnly} refreshKey={selected.model.fingerprint} onChanged={()=>setReload(v=>v+1)} onDraftChange={setHasIntakeDraft} onAccessRejected={rejectAccess}/>:null}
            {application&&!readOnly?<CaseWorkPanel selectedNotificationId={selectedNotificationId} key={selected.id} projectId={selected.id} section={nav.section} onChanged={()=>setReload(v=>v+1)} onDraftChange={setHasDraft}/>:null}
            {guidance.unknown.length?<details className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4" open={nav.mode==="partial"}><summary className="cursor-pointer text-sm font-semibold text-zinc-700">くわしく（記録の細かい状態）</summary><ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-600">{guidance.unknown.map(item=><li key={item}>{item}</li>)}</ul></details>:null}
          </>:nav.projectId?<div className={ui.card}><h1 ref={heading} tabIndex={-1} className="font-semibold outline-none">{selectedPending?"案件データを読み取り中":selectedFailed&&detail?.error!=="not_found"?"案件データを取得できません":"この表示で案件を確認できません"}</h1><p className="mt-3 text-sm text-zinc-600">{link(back,"一覧へ戻る",ui.btnLink)}</p></div>
            :<div className="grid min-h-[480px] place-content-center rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center"><p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-pink-800">Case workspace</p><h2 className="text-xl font-semibold">同じ案件の続きを、ここから。</h2><p className="mt-4 text-sm leading-7 text-zinc-600">左の案件を選ぶと、確定した事実と<br/>次に確認する領域をまとめて表示します。</p></div>}
        </main>
      </div>
    </div>
    <nav aria-label="スマホの主な入口" className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-zinc-200 bg-white px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 lg:hidden">{(Object.keys(entries) as CaseEntry[]).map(entry=>link(entryLocation(entry),entries[entry],
      `flex min-h-11 flex-1 items-center justify-center rounded-xl text-sm font-semibold ${ui.focusRing} ${nav.entry===entry?"bg-pink-50 text-pink-900":"text-zinc-600"}`,{key:entry,"aria-current":nav.entry===entry?"page":undefined}))}</nav>
  </div>;
}
