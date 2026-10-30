"use client";
import { useCallback, useEffect, useRef, useState, type AnchorHTMLAttributes, type Key, type ReactNode } from "react";
import { natoriAdminUi as ui } from "../../constants/adminUi";
import { CASE_SECTIONS, type CaseEntry, type CaseOverviewPart, type CaseWorkspaceRecord } from "../../types/caseWorkspace";
import { caseDate, caseDaysUntil, caseKnown, caseTime, caseTargetSection, CASE_SECTION_LABELS, caseWaitLine, deriveCaseGuidance, observationLabel } from "../../lib/caseWorkspacePresentation";
import { CASE_NOTICE_PURPOSES, caseNoticeLabel, caseShelved, matchesCaseEntry } from "../../lib/caseWorkspaceEntries";
import { caseDefaultFilter, caseWorkspaceHref, parseCaseWorkspaceLocation, type CaseWorkspaceLocation } from "../../lib/caseWorkspaceNavigation";
import {publicAcceptanceTarget} from "@/lib/caseAcceptanceEnvironment";
import {CaseRegistration} from "./CaseRegistration";
import { CaseWorkPanel } from "./CaseWorkPanel";
import { CaseWorkspaceSections } from "./CaseWorkspaceSections";
import { CaseWorkspaceLoadError } from "../../types/caseWorkspaceLoad";
import { CaseMonthPicker } from "./CaseMonthPicker";
import {CasePersonalSchedule} from "./CasePersonalSchedule";
import {loadCaseNoticeIndex,loadCasePersonalEvents,loadCaseTalkPreviews} from "../../data/supabaseCaseEntries";
import {fetchOwnNatoriProfile} from "../../data/supabaseProfile";
import type {CaseTalkPreview,CaseNoticeIndex,CasePersonalEvent} from "../../types/caseEntryIndex";
import {notificationPurposeName} from "../../lib/notificationLabels";
import {loadCasePlanning} from "../../data/supabaseCaseScreen";
import type {CasePlanning} from "../../lib/caseScreenContext";
import {casePlanProject,casePlannedBars,casePriority,CASE_PLAN_STAGE_LABELS} from "../../lib/casePlanning";
import {getDeliveryPlanMeta} from "../../lib/deliveryPlans";
import {CaseIntakePanel} from "./CaseIntakePanel";
import {CaseHistoryPanel} from "./CaseHistoryPanel";
import {CaseWorkspaceUtilities} from "./CaseWorkspaceUtilities";
import {CaseStepList} from "./CaseStepList";
import {CasePublicPages} from "./CasePublicPages";
import {NatoriAdminFont} from "../admin/NatoriAdminFont";
import {caseStepForSection,deriveCaseSteps} from "../../lib/caseSteps";
import {workspaceLook as look} from "../../constants/workspaceLook";

export type CasePreviewLoader = (mode: CaseWorkspaceLocation["mode"], signal: AbortSignal) => Promise<readonly CaseWorkspaceRecord[]>;
const entries: Record<CaseEntry,string> = { cases: "案件", schedule: "予定", notifications: "トーク" };
/** The その他 menu: each item opens on its own instead of every panel at once. */
const OVERVIEW_PARTS: readonly (readonly [CaseOverviewPart,string,"always"|"tools"|"edit"])[] = [["request","依頼の内容","tools"],["decided","決まったこと","always"],["details","案件の情報を直す","edit"],["outside","サイトの外であったことを書く","edit"],["lifecycle","この案件を見送る・しまう","edit"]];
const CASE_FILTER_CHIPS = [["staff","自分の番"],["client","お客さんの番"],["all","すべて"],["completed","完了"]] as const;
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
  const [talkPreviews,setTalkPreviews]=useState<ReadonlyMap<string,CaseTalkPreview>>(new Map());
  const [brand,setBrand]=useState<string|null>(null);
  // The header shows the artist's own name once it is known; the product mark is only a fallback.
  useEffect(()=>{if(!application||!entryTools)return;let live=true;void fetchOwnNatoriProfile().then(p=>{if(live)setBrand(p?.displayName?.trim()||null);}).catch(()=>{});return()=>{live=false;};},[application,entryTools]);
  useEffect(()=>{if(!hasDraft)return;const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};window.addEventListener("beforeunload",guard);return()=>window.removeEventListener("beforeunload",guard);},[hasDraft]);
  useEffect(()=>{const pop=()=>{const next=parseCaseWorkspaceLocation(window.location.search,today);if(hasDraft&&(next.projectId!==nav.projectId||hasUtilityDraft&&next.utility!==nav.utility||hasEventDraft&&(next.date!==nav.date||next.entry!==nav.entry))&&!window.confirm("書きかけの内容があります。このページを離れますか？")){window.history.pushState(null,"",caseWorkspaceHref(nav,basePath));return;}setNav(next);};window.addEventListener("popstate",pop);return()=>window.removeEventListener("popstate",pop);},[today,hasDraft,hasEventDraft,hasUtilityDraft,nav,basePath]);
  const [overviewPart,setOverviewPart]=useState<CaseOverviewPart|null>(null);
  useEffect(()=>{setOverviewPart(null);},[nav.projectId,nav.section]);
  const heading=useRef<HTMLHeadingElement>(null);
  const workHeading=useRef<HTMLHeadingElement>(null),focusedCase=useRef<string|null>(null);
  const [searchOpen]=useState(()=>!!nav.query||nav.sort!=="default"||nav.source!=="all"||nav.intakeFilter!=="all");
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
  // The トーク list's one-line excerpts are an extra layer: if they fail, rows still show who wrote and when.
  const talkEntry=nav.entry==="notifications"&&application&&entryTools;
  useEffect(()=>{
    if(!talkEntry)return;
    const controller=new AbortController();
    loadCaseTalkPreviews(controller.signal).then(items=>setTalkPreviews(new Map(items.map(item=>[item.projectId,item]))),()=>{});
    return()=>controller.abort();
  },[talkEntry,reload]);
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
    if(hasDraft&&(nav.projectId!==next.projectId||hasUtilityDraft&&next.utility!==nav.utility||hasEventDraft&&(next.date!==nav.date||next.entry!==nav.entry))&&!window.confirm("書きかけの内容があります。このページを離れますか？"))return;
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
    // Moving between steps of the same case keeps the reader at the opened step.
    if(nav.projectId){if(focusedCase.current===`${nav.projectId}:${selected?.id}`&&workHeading.current)workHeading.current.focus();else heading.current?.focus();focusedCase.current=`${nav.projectId}:${selected?.id}`;}
    else focusedCase.current=null;
    if(nav.projectId)return;
    else if(nav.selectedId){
      (document.getElementById(`index-notice-${nav.noticeId}`)??document.getElementById(`notice-${nav.noticeId}`)??document.getElementById(`case-${nav.selectedId}`))?.focus({preventScroll:true});
      const position=listPositions.current.get(positionKey);
      if(position!==undefined)window.scrollTo(0,position);
    }
  },[nav.projectId,nav.section,nav.entry,nav.selectedId,nav.noticeId,focusKey,positionKey,selected?.id]);
  const guidance=selected?deriveCaseGuidance(selected):null;
  const steps=selected?deriveCaseSteps(selected):[],openStep=caseStepForSection(steps,nav.section);
  const nextHere=!!guidance&&nav.section===guidance.primary.section&&!!openStep;
  // History and その他 put their own content first; the steps follow below it.
  const sideView=nav.section==="history"||nav.section==="overview";
  // Consultation stays reachable at every step: once it is no longer the current step it opens as a sheet over the steps.
  const currentStep=steps.find(step=>step.state==="current");
  // The トーク tab opens a case on its talk alone; 「案件を見る」 leads to the whole case.
  const chatOnly=nav.entry==="notifications"&&nav.section==="consultation";
  const consultSheet=nav.section==="consultation"&&currentStep?.key!=="consultation"&&!chatOnly;
  const sheetClose:CaseWorkspaceLocation={...nav,section:currentStep&&currentStep.section!=="consultation"?currentStep.section:"overview"};
  const selectedNotice=selected&&nav.noticeId?caseKnown(selected.model.facts.notifications)?.find(n=>n.id===nav.noticeId):undefined;
  const indexNotice=selected&&nav.noticeId?noticeIndex?.items.find(n=>n.id===nav.noticeId&&n.projectId===selected.id):undefined;
  // A talk too long for the case snapshot still gets its sender and time from the トーク list read.
  const talkOf=(row:CaseWorkspaceRecord)=>caseKnown(row.display.conversation)??talkPreviews.get(row.id)??null;
  const visible=rows.filter(row=>matchesCaseEntry(row,nav,plansReady?plans:null,today)).sort((a,b)=>nav.entry==="notifications"&&nav.sort==="default"?(talkOf(b)?.latestAt??"").localeCompare(talkOf(a)?.latestAt??"")||a.id.localeCompare(b.id):nav.sort==="due"?(a.registeredDueDate??"9999").localeCompare(b.registeredDueDate??"9999")||a.id.localeCompare(b.id):nav.sort==="priority"?(casePriority(b,plansReady?plans:null,today)?.score??-1)-(casePriority(a,plansReady?plans:null,today)?.score??-1)||a.id.localeCompare(b.id):0);
  const pages=Math.max(1,Math.ceil(visible.length/50)),pageRows=visible.slice((nav.page-1)*50,nav.page*50);
  const entryLocation=(entry:CaseEntry):CaseWorkspaceLocation=>({...(entry===nav.entry?nav:entryPositions.current.get(entry)??{...nav,query:"",filter:caseDefaultFilter(entry),selectedId:null,noticeId:null,page:1,noticePage:1}),entry,utility:"none",projectId:null,section:"overview"});
  const open=(id:string):CaseWorkspaceLocation=>({...nav,utility:"none",projectId:id,selectedId:id,noticeId:null,historyPage:1,section:nav.source==="estimate"?"transaction":deriveCaseGuidance(rows.find(r=>r.id===id)!).primary.section});
  const back={...nav,projectId:null,section:"overview" as const};
  // A utility link (e.g. back from 実績) must not leave a blank page where that utility cannot be shown.
  const utilityOpen=nav.utility!=="none"&&(application?entryTools:nav.utility==="pages");
  const pagesTab=!application||entryTools,pagesLocation:CaseWorkspaceLocation={...nav,utility:"pages",projectId:null,section:"overview"};
  const entryTitle=nav.entry==="schedule"?`${caseDate(nav.date,today)}の予定`:nav.entry==="notifications"?"トーク":"案件";
  // Urgency only while the work is still ahead: a delivered case no longer races its due date.
  const dueBadge=(row:CaseWorkspaceRecord)=>{
    const step=deriveCaseSteps(row).find(s=>s.state==="current");
    if(!row.registeredDueDate||!step||step.key==="receipt")return null;
    const days=caseDaysUntil(row.registeredDueDate,today);
    return days<0?<span className="inline-block rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-800">納期を{-days}日過ぎています</span>
      :days<=3?<span className="inline-block rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-900">{days===0?"今日が納期":`納期まであと${days}日`}</span>:null;
  };
  const caseCard=(row:CaseWorkspaceRecord)=>{const g=deriveCaseGuidance(row),active=nav.projectId===row.id,step=deriveCaseSteps(row).find(s=>s.state==="current"),due=dueBadge(row);return <div key={row.id}>{link(open(row.id),<>
            <span className="flex flex-wrap gap-1.5"><span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${step?"bg-pink-100 text-pink-900":"bg-zinc-100 text-zinc-600"}`}>{step?.label??g.status}</span>{due}</span>
            <p className={`mt-1 text-[17px] leading-6 ${look.title}`}>{row.title}</p><p className="text-xs text-zinc-500">{row.clientLabel} · {row.registeredDueDate?`納期の目安 ${caseDate(row.registeredDueDate,today)}`:"納期なし"}</p>
            {g.waits[0]?<p className={`mt-1.5 text-[13px] leading-5 ${g.waits[0].who==="staff"?"font-bold text-pink-800":"text-zinc-500"}`}>{caseWaitLine(g.waits[0])}</p>:<p className="mt-1.5 text-[13px] text-zinc-500">{g.status}</p>}
            {nav.sort==="priority"?<p className="mt-2 text-xs">優先理由：{casePriority(row,plansReady?plans:null,today)?.reasons.join(" / ")??"理由は分かりません"}</p>:null}
            {nav.entry==="schedule"?<p className="mt-2 text-xs">{row.registeredDueDate===nav.date?"この日が納期":"作業の予定日"}{casePlannedBars(row,plansReady?plans:null,today).filter(b=>b.startISO<=nav.date&&b.endISO>=nav.date).map(b=>` · ${CASE_PLAN_STAGE_LABELS[b.stage]} ${caseDate(b.startISO,today)}〜${caseDate(b.endISO,today)}`).join("")}{(()=>{const p=casePlanProject(row,plansReady?plans:null);return p&&getDeliveryPlanMeta(p.deliveryPlan).isRush?` · ${getDeliveryPlanMeta(p.deliveryPlan).shortLabel}`:"";})()}</p>:null}
            {active||row.id===nav.selectedId?<p className="mt-2 text-xs font-semibold text-pink-800">{active?"選択中":"さっき開いた案件"}</p>:null}
          </>,`${look.card} block ${active?"!border-pink-600 ring-2 ring-pink-200":look.cardHover} ${ui.focusRing}`,{id:`case-${row.id}`,"aria-current":active?"page":undefined})}
          </div>;};
  const caseRow=(row:CaseWorkspaceRecord)=>{const g=deriveCaseGuidance(row),active=nav.projectId===row.id,due=dueBadge(row);return link(open(row.id),<><span className="min-w-0 truncate font-medium">{row.title}<span className="sr-only"> · {row.clientLabel}</span></span><span className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-500">{due}{g.waits[0]?.text??g.status}</span></>,
    `flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm ${look.row} ${active?"!border-pink-500":"hover:border-pink-300"} ${ui.focusRing}`,{key:row.id,id:`case-${row.id}`,"aria-current":active?"page":undefined});};
  // トーク tab: one line per case; who wrote last and when. Opening it shows only the talk.
  const talkRow=(row:CaseWorkspaceRecord)=>{const talk=talkOf(row),active=nav.projectId===row.id,theirs=talk?.latestSender==="client";return link({...open(row.id),section:"consultation"},<>
    <span className="flex items-center gap-2"><span className={`min-w-0 flex-1 truncate text-[15px] ${look.title}`}>{row.title}</span>{theirs?<span className="h-2.5 w-2.5 shrink-0 rounded-full bg-pink-500" role="img" aria-label="お客さんが最後に書いています"/>:null}</span>
    <span className={`mt-0.5 block text-xs ${theirs?"font-bold text-pink-800":"text-zinc-500"}`}>{row.clientLabel} · {talk?`${theirs?"お客さんが書きました":"あなたが書きました"} · ${caseTime(talk.latestAt)}`:observationLabel(row.display.conversation)}</span>
    {talk&&talkPreviews.get(row.id)?.excerpt?<span className="mt-1 block truncate text-[13px] text-zinc-700">{talkPreviews.get(row.id)?.excerpt}</span>:null}
  </>,`block px-3 py-2.5 ${look.row} ${active?"!border-pink-500":"hover:border-pink-300"} ${ui.focusRing}`,{key:row.id,id:`case-${row.id}`,"aria-current":active?"page":undefined});};
  return <div data-natori-admin className={`${look.page} pb-24 lg:pb-6`}><NatoriAdminFont/>
    {!application||readOnly?<div className="border-b border-pink-100 bg-pink-50 px-4 py-2 text-center text-xs leading-5 text-pink-950">{readOnly?"いまは見るだけです。送信や保存はできません。":"見本の画面です。操作しても何も送られません。"}</div>:null}
    <header className={look.header}><div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
      {brand?<p className={`min-w-0 truncate ${look.brand}`}>{brand}</p>:<p className={look.brand}>natori<span className="text-pink-500">.</span></p>}
      <nav aria-label="主な入口" className="hidden items-center gap-2 lg:flex">{(Object.keys(entries) as CaseEntry[]).map(entry=>link(entryLocation(entry),entries[entry],
        `${ui.btnSecondary} ${look.zen} ${nav.entry===entry&&nav.utility==="none"?"!border-pink-700 !bg-pink-700 !text-white":""}`,{"aria-current":nav.entry===entry&&nav.utility==="none"?"page":undefined,key:entry}))}{pagesTab?link(pagesLocation,"ページ",`${ui.btnSecondary} ${look.zen} ${nav.utility==="pages"?"!border-pink-700 !bg-pink-700 !text-white":""}`,{"aria-current":nav.utility==="pages"?"page":undefined,key:"pages"}):null}</nav>
      {application&&entryTools?link({...nav,utility:"settings"},<>その他<span aria-hidden="true"> ⋯</span></>,`rounded-lg px-2 py-2 text-sm font-semibold ${nav.utility==="settings"||nav.utility==="estimate"?"text-pink-800":"text-zinc-600"} ${ui.focusRing}`,{"aria-current":nav.utility==="settings"?"page":undefined}):null}
      {!application?<details className="text-xs text-zinc-600"><summary className="cursor-pointer rounded-lg p-2 focus-visible:outline">表示の検証</summary><label className="mt-2 block">架空データの取得状態
        <select className="ml-2 rounded border p-2" aria-label="架空データの取得状態" value={nav.mode} onChange={e=>move({...nav,mode:e.target.value as CaseWorkspaceLocation["mode"]})}>
          <option value="normal">通常</option><option value="partial">一部取得失敗</option><option value="failed">最新読取失敗</option></select></label></details>:null}
    </div></header>
    <div className="mx-auto max-w-[1440px] px-4 pt-4 sm:px-6">
      {!application&&nav.utility==="pages"?<section aria-label="公開ページ" className="mb-5"><h1 className="text-xl font-semibold">公開ページ</h1><p className="mb-4 mt-1 text-sm text-zinc-600">お客さんが見るページです。</p><CasePublicPages portfolioHref="/natori/portfolio" linksHref="/natori/links"/></section>:null}
      {application&&entryTools&&nav.utility!=="none"?<div className="mb-5"><div className="mb-4 flex flex-wrap items-center gap-3">{nav.utility!=="pages"?link({...nav,utility:"none"},"← 元の案件画面へ戻る",`${ui.btnLink}`):null}</div>{!accessError?<CaseWorkspaceUtilities key={nav.utility} mode={nav.utility} readOnly={readOnly} onDraftChange={setHasUtilityDraft} onAccessRejected={rejectAccess}/>:<p role="alert">ログインが切れました。もう一度ログインしてください。</p>}</div>:null}
      {failed?<div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><p>{accessError==="unauthorized"?"ログインが切れました。もう一度ログインしてください。":accessError==="scope_unavailable"?"このアカウントでは案件を表示できません。":loadDetail&&nav.projectId?"案件の一覧を読み込めませんでした。":`最新の情報を読み込めませんでした。${records?"前に読み込んだ内容を表示しています。":""}`}</p>
        <button type="button" className={ui.btnSecondary} disabled={pending} onClick={()=>setReload(v=>v+1)}>再読み込み</button></div>:null}
      <div role="status" className="sr-only">{pending?"読み込み中":failed?"読み込めませんでした":"読み込みました"}</div>
      {entryTools&&!pending&&!failed&&(personalEventsEnabled&&!eventsReady||!noticesReady)?<button type="button" className={`${ui.btnSecondary} mb-4`} onClick={()=>setReload(v=>v+1)}>予定と通知を再読み込み</button>:null}
      <div className={`${utilityOpen?"hidden":"grid"} gap-6 lg:grid-cols-[21rem_minmax(0,1fr)]`}>
        <aside aria-label={entryTitle} className={`${nav.projectId?"hidden lg:block":""} min-w-0`}>
          {/* Registration is a small button beside the case heading; its form opens below the heading. */}
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2"><h1 className={`text-xl ${look.title}`}>{entryTitle}</h1><span className="text-xs text-zinc-500">{records===null?"件数を読み込み中":`${pending||failed?"前回：":""}${visible.length}案件`}</span>
            {nav.entry==="cases"&&application&&entryTools&&personalEventsEnabled&&!publicAcceptanceTarget(true)&&!readOnly?<CaseRegistration today={today} onChanged={()=>setReload(v=>v+1)} onDraftChange={setHasRegistrationDraft} onOpen={id=>{const next={...nav,entry:"cases" as const,projectId:id,selectedId:id,section:"overview" as const};move(next);setReload(v=>v+1);}}/>:null}</div>
          {nav.entry==="cases"?<div role="group" aria-label="対応で絞り込む" className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">{CASE_FILTER_CHIPS.map(([value,label])=><button key={value} type="button" aria-pressed={nav.filter===value} onClick={()=>move({...nav,filter:value})}
            className={`min-h-9 shrink-0 whitespace-nowrap rounded-full border-[1.5px] px-2.5 ${look.zen} text-[13px] font-bold lg:px-2 lg:text-[12px] ${ui.focusRing} ${nav.filter===value?look.chipOn:look.chipOff}`}>{label}{records!==null?<span className="ml-1.5">{rows.filter(row=>matchesCaseEntry(row,{...nav,filter:value},plansReady?plans:null,today)).length}</span>:null}</button>)}</div>:null}
          <details open={searchOpen} className={`mb-4 ${look.row}`}><summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-zinc-600">検索・並び替え</summary><div className="space-y-3 px-3 pb-3">          <label className="block text-xs font-semibold text-zinc-600">案件を検索<input type="search" value={nav.query} onChange={e=>move({...nav,query:e.target.value},true)} placeholder="案件名かお客さんの名前" className="mt-1 block h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm" /></label>
            <label className="block text-xs font-semibold text-zinc-600">案件の並び<select className="mt-1 h-11 w-full rounded-xl border px-3" value={nav.sort} onChange={e=>move({...nav,sort:e.target.value as CaseWorkspaceLocation["sort"]})}><option value="default">受付順</option><option value="due">納期が近い順</option><option value="priority">急ぎの順</option></select></label>
            {nav.source!=="all"||nav.intakeFilter!=="all"?<><p className="text-xs">{nav.source==="inquiries"?"問い合わせの一覧から開いています。":nav.source==="estimate"?"見積の一覧から開いています。":"問い合わせの条件で絞り込んでいます。"}</p><label className="block text-xs font-semibold">問い合わせの絞り込み<select className={ui.input} value={nav.intakeFilter} onChange={e=>move({...nav,intakeFilter:e.target.value as CaseWorkspaceLocation["intakeFilter"]})}><option value="all">すべて</option><option value="attention">対応・確認が必要</option><option value="rough-ok">ラフOKをもらった</option><option value="ended">見送り・保管</option><option value="inquiry">相談受付</option><option value="estimating">見積下書き</option><option value="quoted">見積を出した</option><option value="awaiting_payment">支払い待ち</option></select></label></>:null}
          </div></details>
          <div className="mb-4 space-y-3">
            {nav.entry==="schedule"?<><CaseMonthPicker nav={nav} records={rows.filter(row=>!caseShelved(row))} available={!pending&&!failed&&records!==null} onChange={move} plans={plansReady?plans:null} today={today} events={entryTools&&personalEventsEnabled?eventsReady?personalEvents:null:undefined}/></>:null}
          </div>
          {nav.entry==="schedule"&&application&&entryTools&&!plansReady?<p className="mb-4 text-xs leading-6 text-amber-900">作業の予定を読み込めなかったので、納期だけを表示しています。</p>:null}
          {nav.entry==="schedule"&&application&&entryTools?(personalEventsEnabled?<CasePersonalSchedule key={nav.date} date={nav.date} events={personalEvents} available={eventsReady} readOnly={readOnly} onChanged={()=>setReload(v=>v+1)} onDraftChange={setHasEventDraft}/>:<p className="mb-4 text-xs text-amber-900">この画面では自分の予定は使えません。</p>):null}
          <div className="space-y-3">{nav.entry==="cases"&&nav.filter==="all"?<>
            {pageRows.filter(row=>deriveCaseGuidance(row).waits[0]?.who==="staff").map(caseCard)}
            {([["client","お客さんの番"],["other","そのほか"]] as const).map(([group,label])=>{const items=pageRows.filter(row=>{const who=deriveCaseGuidance(row).waits[0]?.who;return group==="client"?who==="client":who!=="staff"&&who!=="client";});
              return items.length?<section key={group} aria-label={label}><h2 className={`mb-2 mt-5 text-[14px] text-zinc-600 ${look.title}`}>{label}（{items.length}件）</h2><div className="space-y-1.5">{items.map(caseRow)}</div></section>:null;})}
          </>:nav.entry==="notifications"?<div className="space-y-1.5">{pageRows.map(talkRow)}</div>:pageRows.map(caseCard)}
            {pending && records===null?<p className="p-4 text-sm text-zinc-600">読み込み中…</p>:!failed&&visible.length===0?<p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">{nav.entry==="notifications"?"まだトークのある案件はありません。":"この条件の案件はありません。"}</p>:null}
            {!pending&&!failed&&records!==null&&(pages>1||nav.page>1)?<nav aria-label="案件のページ" className="flex flex-wrap items-center gap-2 text-xs"><span>{nav.page} / {pages}ページ</span><button className={ui.btnSecondary} disabled={nav.page<=1} onClick={()=>move({...nav,page:nav.page-1})}>前の案件</button><button className={ui.btnSecondary} disabled={nav.page>=pages} onClick={()=>move({...nav,page:nav.page+1})}>次の案件</button>{nav.page>pages?<button className={ui.btnSecondary} onClick={()=>move({...nav,page:1})}>一覧が変わりました。最初のページへ</button>:null}</nav>:null}
          </div>
        </aside>
        <main className={`${!nav.projectId?"hidden lg:block":""} min-w-0`}>
          {loadDetail&&nav.projectId&&detail?.error&&detail.error!=="not_found"?<p role="alert" className="mb-3 text-sm text-amber-900">この案件の最新の内容を読み込めませんでした。ページを読み込み直してください。</p>:null}
          {selected&&guidance?<>
            <div className="mb-4">{link(back,`← ${nav.entry==="schedule"?`${caseDate(nav.date,today)}の予定`:entries[nav.entry]}へ戻る`,`${ui.btnLink} min-h-11`)}</div>
            <section className="mb-5 border-b-2 border-dashed border-pink-200 pb-4" aria-label="案件の共通案内">
              <h1 ref={heading} tabIndex={-1} className={`text-[22px] leading-9 outline-none sm:text-2xl ${look.title}`}>{selected.title}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500"><span>{selected.clientLabel} · {selected.registeredDueDate?`納期の目安 ${caseDate(selected.registeredDueDate,today)}`:"納期なし"}</span>{dueBadge(selected)}</p>
              {chatOnly?<p className="mt-2">{link({...nav,entry:"cases",filter:caseDefaultFilter("cases"),noticeId:null,section:guidance.primary.section},<>案件を見る<span aria-hidden="true"> ›</span></>,`${ui.btnLink} min-h-11`)}</p>:<>
              {nav.noticeId?<aside aria-label="選択した通知" className="mt-3 rounded-xl border border-zinc-200 p-3 text-sm">{selectedNotice?<><p className="font-semibold">{CASE_NOTICE_PURPOSES[selectedNotice.purpose]} · {caseNoticeLabel(selectedNotice)}</p><p className="mt-1 text-xs text-zinc-600">{caseTime(selectedNotice.recordedAt)} · 前の見積や条件について送ったメールのこともあります。</p></>:indexNotice?<p className="font-semibold">{notificationPurposeName(indexNotice.purpose)}のメール</p>:"このメールの記録が見つかりませんでした。"}</aside>:null}
              <p className={selectedFailed||selectedPending||(!openStep&&!sideView)||!steps.some(step=>step.state==="current")?"mt-3 text-sm font-semibold text-pink-900":"sr-only"}>{selectedFailed||selectedPending?"前に読み込んだ時の段階：":"いまの段階："}{guidance.status}</p>
              {!nextHere&&!consultSheet?<div className={`mt-3 rounded-[16px_12px_18px_11px] border-[1.5px] border-pink-300 bg-pink-50 ${sideView?"px-3 py-2":"p-4"}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className={sideView?"sr-only":"text-xs font-semibold text-pink-900"}>{selectedFailed?"前に読み込んだ時の、次にやること":"次にやること"}</p>
                <p className={sideView?"text-sm leading-6":"mt-1 text-sm font-semibold leading-6"}>{guidance.waits[0]?caseWaitLine(guidance.waits[0]):"いまやることはありません"}</p></div>
                {link({...nav,section:guidance.primary.section},guidance.primary.label,sideView?`${ui.btnLink} min-h-11`:ui.btnPrimary)}</div></div>:null}
              {selectedNotificationId&&nav.section!=="transaction"?<p className="mt-3 text-sm">{link({...nav,section:"transaction"},"このメールの送信結果を見る",ui.btnLink)}</p>:null}
            {guidance.waits.length>1&&!sideView?<ul aria-label="ほかにやること" className="mt-3 space-y-1">{guidance.waits.slice(1).map(wait=><li key={wait.key} className="text-sm">{link({...nav,section:wait.section},caseWaitLine(wait),ui.btnLink)}</li>)}</ul>:null}
              {guidance.unknown.filter(item=>item.startsWith("要確認：")).map(item=><p key={item} className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{item}</p>)}
              </>}
            </section>
            <CaseStepList steps={steps} selected={openStep} trailing={sideView} bare={chatOnly} sheet={consultSheet?{close:link(sheetClose,<>閉じる<span aria-hidden="true"> ×</span></>,`inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-zinc-600 ${ui.focusRing}`),
              backdrop:link(sheetClose,<span className="sr-only">相談を閉じる</span>,"fixed inset-0 z-30 bg-zinc-900/40 lg:hidden",{tabIndex:-1,"aria-hidden":true}),onEscape:()=>move(sheetClose)}:null}
              link={(step,content,className,attributes)=>link({...nav,section:step.section},content,`${className} ${ui.focusRing}`,{...attributes,key:step.key})}>
              {nextHere&&guidance.waits[0]&&!chatOnly?<p className="sr-only">{selectedFailed?"前に読み込んだ時の、次にやること":"次にやること"} · {CASE_SECTION_LABELS[nav.section]}</p>:null}
              <h2 ref={workHeading} tabIndex={-1} className={`mb-3 text-base leading-7 outline-none ${look.title}`}>{chatOnly?"トーク":nextHere&&guidance.waits[0]?caseWaitLine(guidance.waits[0]):nav.section==="overview"&&overviewPart?OVERVIEW_PARTS.find(([key])=>key===overviewPart)?.[1]:CASE_SECTION_LABELS[nav.section]}</h2>
              {nav.section==="overview"?overviewPart?<button type="button" className={`${ui.btnLink} -mt-2 mb-2`} onClick={()=>setOverviewPart(null)}>← その他に戻る</button>
                :<ul aria-label="その他のメニュー" className="divide-y divide-dashed divide-zinc-300">{OVERVIEW_PARTS.filter(([,,need])=>need==="always"||need==="tools"&&application&&entryTools||need==="edit"&&application&&!readOnly).map(([key,label])=><li key={key}><button type="button" onClick={()=>setOverviewPart(key)} className={`flex min-h-12 w-full items-center justify-between gap-3 px-1 text-left text-[15px] font-semibold ${ui.focusRing}`}>{label}<span aria-hidden="true" className="text-zinc-400">›</span></button></li>)}</ul>:null}
              {chatOnly?null:<CaseWorkspaceSections selectedNotificationId={selectedNotificationId} record={selected} section={nav.section} step={openStep} application={application} readOnly={readOnly} onChanged={()=>setReload(v=>v+1)} overviewPart={overviewPart}/>}
              {application&&entryTools?<CaseHistoryPanel key={`history-${selected.id}`} projectId={selected.id} section={nav.section} refreshKey={selected.model.fingerprint} page={nav.historyPage??1} onNotice={id=>move({...nav,noticeId:id,section:"transaction"})} onPage={page=>move({...nav,historyPage:page})} onAccessRejected={rejectAccess}/>:null}
              <div hidden={chatOnly}>{application&&entryTools?<CaseIntakePanel key={`intake-${selected.id}`} projectId={selected.id} section={nav.section} overviewPart={overviewPart} readOnly={readOnly} refreshKey={selected.model.fingerprint} onChanged={()=>setReload(v=>v+1)} onDraftChange={setHasIntakeDraft} onAccessRejected={rejectAccess}/>:null}</div>
              {application&&!readOnly?<CaseWorkPanel selectedNotificationId={selectedNotificationId} key={selected.id} projectId={selected.id} section={nav.section} overviewPart={overviewPart} onChanged={()=>setReload(v=>v+1)} onDraftChange={setHasDraft}/>:null}
            </CaseStepList>
            <nav aria-label="案件のほかの画面" className={`${chatOnly?"!hidden ":""}fixed inset-x-0 bottom-0 z-20 flex justify-around border-t-2 border-dashed border-pink-200 bg-[#FBF7F4] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 lg:static lg:mb-5 lg:grid lg:grid-cols-3 lg:gap-2 lg:border-0 lg:bg-transparent lg:p-0`}>{(["consultation","history","overview"] as const).map(section=>link({...nav,section},<>{CASE_SECTION_LABELS[section]}{section==="consultation"&&caseKnown(selected.display.conversation)?.latestSender==="client"?<span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-pink-500" role="img" aria-label="お客さんが最後に書いています"/>:null}</>,
              `flex min-h-11 flex-1 items-center justify-center rounded-xl ${look.zen} text-sm font-bold lg:border-[1.5px] ${ui.focusRing} ${nav.section===section?"bg-pink-100 text-pink-900 lg:border-pink-700 lg:bg-pink-700 lg:text-white":"text-zinc-600 lg:border-[#3B2F33]/25 lg:bg-white"}`,{key:section,"aria-current":nav.section===section?"page":undefined}))}</nav>
            {selectedFailed?<p className="mb-5 text-xs leading-5 text-zinc-500">{caseTime(selected.model.checkedAt)}に読み込んだ内容です</p>:null}
            {guidance.unknown.some(item=>!item.startsWith("要確認："))&&!chatOnly?<div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-semibold">読み込めなかった記録があります</p><ul className="mt-1 space-y-1">{guidance.unknown.filter(item=>!item.startsWith("要確認：")).map(item=><li key={item}>{item}</li>)}</ul></div>:null}
          </>:nav.projectId?<div className={ui.card}><h1 ref={heading} tabIndex={-1} className="font-semibold outline-none">{selectedPending?"読み込み中":selectedFailed&&detail?.error!=="not_found"?"案件を読み込めませんでした":"この案件は見つかりませんでした"}</h1><p className="mt-3 text-sm text-zinc-600">{link(back,"一覧へ戻る",ui.btnLink)}</p></div>
            :<div className="grid min-h-[480px] place-content-center rounded-[26px_20px_28px_19px] border-2 border-dashed border-pink-200 bg-white/60 p-8 text-center"><h2 className={`text-xl ${look.title}`}>案件を選んでください</h2><p className="mt-4 text-sm leading-7 text-zinc-600">左の一覧から選ぶと、ここに次にやることが出ます。</p></div>}
        </main>
      </div>
    </div>
    <nav aria-label="スマホの主な入口" className={`${selected&&guidance?"hidden":"flex"} fixed inset-x-0 bottom-0 z-20 justify-around border-t-2 border-dashed border-pink-200 bg-[#FBF7F4] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 lg:hidden`}>{(Object.keys(entries) as CaseEntry[]).map(entry=>link(entryLocation(entry),entries[entry],
      `flex min-h-11 flex-1 items-center justify-center rounded-xl ${look.zen} text-sm font-bold ${ui.focusRing} ${nav.entry===entry&&nav.utility==="none"?"bg-pink-100 text-pink-900":"text-zinc-600"}`,{key:entry,"aria-current":nav.entry===entry&&nav.utility==="none"?"page":undefined}))}{pagesTab?link(pagesLocation,"ページ",`flex min-h-11 flex-1 items-center justify-center rounded-xl ${look.zen} text-sm font-bold ${ui.focusRing} ${nav.utility==="pages"?"bg-pink-100 text-pink-900":"text-zinc-600"}`,{key:"pages","aria-current":nav.utility==="pages"?"page":undefined}):null}</nav>
  </div>;
}
