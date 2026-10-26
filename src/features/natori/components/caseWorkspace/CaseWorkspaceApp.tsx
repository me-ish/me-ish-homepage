"use client";
import {useEffect,useState} from "react";
import { CaseWorkspacePreview } from "./CaseWorkspacePreview";
import { loadCaseWorkspace, loadCaseWorkspaceDetail,loadCaseSystemPaused } from "../../data/supabaseCaseWorkspace";
import {CaseWorkspaceLoadError} from "../../types/caseWorkspaceLoad";

export function CaseWorkspaceApp({ initialSearch, today,readOnly=false,entryTools=false,personalEventsEnabled=true }: { initialSearch: string; today: string;readOnly?:boolean;entryTools?:boolean;personalEventsEnabled?:boolean }) {
  const [paused,setPaused]=useState(readOnly),[unauthorized,setUnauthorized]=useState(false);
  useEffect(()=>{
   let generation=0,controller:AbortController|undefined;
   const refresh=async()=>{
    const current=++generation;controller?.abort();controller=new AbortController();
    try{const held=await loadCaseSystemPaused(controller.signal);if(current===generation&&held)setPaused(true);}
    catch(error){if(current!==generation||controller.signal.aborted)return;setPaused(true);if(error instanceof CaseWorkspaceLoadError&&error.kind==="unauthorized")setUnauthorized(true);}
   };
   const focus=()=>{void refresh();};void refresh();
   const timer=window.setInterval(focus,15000);window.addEventListener("focus",focus);
   return ()=>{generation++;controller?.abort();window.clearInterval(timer);window.removeEventListener("focus",focus);};
  },[]);
  if(unauthorized)return <p role="alert">認証を確認できないため案件の表示を消去しました。ログインを確認して再読み込みしてください。</p>;
  // A stop latches for this page. Resumption requires a fresh server render;
  // no late poll or automatic retry can revive a stale confirmation panel.
  return <CaseWorkspacePreview load={loadCaseWorkspace} loadDetail={entryTools?loadCaseWorkspaceDetail:undefined} application entryTools={entryTools} personalEventsEnabled={personalEventsEnabled} readOnly={readOnly||paused} initialSearch={initialSearch} today={today} basePath="/natori/dashboard/cases" />;
}
