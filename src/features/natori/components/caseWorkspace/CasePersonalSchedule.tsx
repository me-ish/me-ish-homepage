"use client";
import {useState} from "react";
import PersonalEventsSection from "../dashboard/PersonalEventsSection";
import {createNatoriEvent,updateNatoriEvent,deleteNatoriEvent} from "../../data/supabaseEvents";
import type {CasePersonalEvent} from "../../types/caseEntryIndex";
import {getRemindersForDate} from "../../lib/reminders";

export function CasePersonalSchedule({date,events,available,readOnly,onChanged,onDraftChange}:{date:string;events:readonly CasePersonalEvent[]|null;available:boolean;readOnly:boolean;onChanged:()=>void;onDraftChange:(active:boolean)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const run=async(action:()=>Promise<unknown>)=>{setBusy(true);setError(null);try{await action();onChanged();}catch{setError("保存できたか分かりません。入力し直す前に、予定を読み込み直してください。");throw Error("event_save_unconfirmed");}finally{setBusy(false);}};
 return <section aria-label="自分の予定" className="mt-4 text-sm">
  <h2 className="font-semibold">自分の予定</h2>
  {!available?<p role="status" className="mt-2 text-amber-900">{events===null?"予定を読み込めていません。":"前に読み込んだ予定です。読み込み直してから編集してください。"}</p>:null}
  {getRemindersForDate(date).map(row=><p key={row.id} className="mt-2 rounded-xl bg-amber-50 p-3">{row.label}<span className="block text-xs">{row.detail}</span></p>)}
  {error?<button className="mt-2 rounded-lg border p-2" onClick={onChanged}>予定を読み込み直す</button>:null}
  {events!==null?(readOnly?<div className="mt-2 rounded-xl border bg-white p-3"><p className="text-xs">この日の予定（見るだけ）</p>{events.filter(e=>e.date===date).map(e=><p key={e.id} className="mt-2 break-words">{e.title}{e.note?<span className="block text-xs">{e.note}</span>:null}</p>)}{available&&!events.some(e=>e.date===date)?<p>この日の予定はありません。</p>:null}</div>:<PersonalEventsSection selectedISO={date} events={[...events]} authed={available} busy={busy||!available} error={error} onDraftChange={onDraftChange} onCreate={input=>run(()=>createNatoriEvent(input))} onUpdate={(id,input)=>run(()=>updateNatoriEvent(id,input))} onDelete={id=>run(()=>deleteNatoriEvent(id)).catch(()=>{})}/>):null}
 </section>;
}
