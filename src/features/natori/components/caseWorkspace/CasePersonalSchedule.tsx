"use client";
import {useState} from "react";
import PersonalEventsSection from "../dashboard/PersonalEventsSection";
import {createNatoriEvent,updateNatoriEvent,deleteNatoriEvent} from "../../data/supabaseEvents";
import type {CasePersonalEvent} from "../../types/caseEntryIndex";
import {getRemindersForDate} from "../../lib/reminders";

export function CasePersonalSchedule({date,events,available,readOnly,onChanged,onDraftChange}:{date:string;events:readonly CasePersonalEvent[]|null;available:boolean;readOnly:boolean;onChanged:()=>void;onDraftChange:(active:boolean)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const run=async(action:()=>Promise<unknown>)=>{setBusy(true);setError(null);try{await action();onChanged();}catch{setError("予定の保存結果を確認できません。再入力する前に表示を再取得してください。");throw Error("event_save_unconfirmed");}finally{setBusy(false);}};
 return <section aria-label="個人予定" className="mt-4 text-sm">
  <h2 className="font-semibold">個人予定・定期の確認</h2><p className="mt-1 text-xs text-zinc-600">個人予定は案件の進捗・入金・受取を変更しません。</p>
  {!available?<p role="status" className="mt-2 text-amber-900">{events===null?"個人予定はまだ確認できていません。":"前回確認した個人予定です。最新の取得を確認してから編集してください。"}</p>:null}
  {getRemindersForDate(date).map(row=><p key={row.id} className="mt-2 rounded-xl bg-amber-50 p-3">{row.label}<span className="block text-xs">{row.detail}</span></p>)}
  {error?<button className="mt-2 rounded-lg border p-2" onClick={onChanged}>予定を再取得して結果を確認</button>:null}
  {events!==null?(readOnly?<div className="mt-2 rounded-xl border bg-white p-3"><p className="text-xs">この日の個人予定（照会のみ）</p>{events.filter(e=>e.date===date).map(e=><p key={e.id} className="mt-2 break-words">{e.title}{e.note?<span className="block text-xs">{e.note}</span>:null}</p>)}{available&&!events.some(e=>e.date===date)?<p>この日に個人予定はありません。</p>:null}</div>:<PersonalEventsSection selectedISO={date} events={[...events]} authed={available} busy={busy||!available} error={error} onDraftChange={onDraftChange} onCreate={input=>run(()=>createNatoriEvent(input))} onUpdate={(id,input)=>run(()=>updateNatoriEvent(id,input))} onDelete={id=>run(()=>deleteNatoriEvent(id)).catch(()=>{})}/>):null}
 </section>;
}
