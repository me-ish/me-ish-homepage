"use client";
import type { CaseWorkspaceLocation } from "../../lib/caseWorkspaceNavigation";
import { caseMonthDays, matchesCaseEntry } from "../../lib/caseWorkspaceEntries";
import type { CaseWorkspaceRecord } from "../../types/caseWorkspace";
import type {CasePersonalEvent} from "../../types/caseEntryIndex";
import type {CasePlanning} from "../../lib/caseScreenContext";
import {casePlannedBars,CASE_PLAN_STAGE_LABELS} from "../../lib/casePlanning";
import {assignBarLanes} from "../../lib/projects";
import {caseCalendarColors} from "../../lib/caseCalendarColors";

export function CaseMonthPicker({nav,records,available,onChange,events,plans=null,today=nav.date}:{nav:CaseWorkspaceLocation;records:readonly CaseWorkspaceRecord[];available:boolean;onChange:(next:CaseWorkspaceLocation)=>void;events?:readonly CasePersonalEvent[]|null;plans?:CasePlanning|null;today?:string}) {
  const days=caseMonthDays(nav.month), start=days[0]?new Date(`${days[0]}T00:00:00Z`).getUTCDay():0;
  const bars=available?records.filter(r=>matchesCaseEntry(r,{...nav,entry:"cases"})).flatMap(r=>casePlannedBars(r,plans,today)):[],lanes=assignBarLanes(bars),colors=caseCalendarColors(bars);
  // Month names come from the page, not the browser's month input, which shows the device language.
  const shift=(by:number)=>{const [year,month]=nav.month.split("-").map(Number),next=new Date(Date.UTC(year,month-1+by,1)),value=`${next.getUTCFullYear()}-${String(next.getUTCMonth()+1).padStart(2,"0")}`;if(caseMonthDays(value).length)onChange({...nav,month:value});};
  return <section aria-label="納期のカレンダー" className="space-y-2">
    <div className="flex items-center justify-between gap-2"><button type="button" aria-label="前の月" onClick={()=>shift(-1)} className="min-h-11 min-w-11 rounded-xl border border-zinc-200 bg-white text-lg text-zinc-700">‹</button>
      <h2 className="text-base font-semibold" aria-live="polite">{Number(nav.month.slice(0,4))}年{Number(nav.month.slice(5,7))}月</h2>
      <button type="button" aria-label="次の月" onClick={()=>shift(1)} className="min-h-11 min-w-11 rounded-xl border border-zinc-200 bg-white text-lg text-zinc-700">›</button></div>
    <div className="grid grid-cols-7 gap-1 text-center text-xs">
      {["日","月","火","水","木","金","土"].map(day=><span key={day} className="py-1 text-zinc-500">{day}</span>)}
      {Array.from({length:start},(_,i)=><span key={`blank-${i}`}/>)}
      {days.map(date=>{const count=available?records.filter(row=>row.registeredDueDate===date&&matchesCaseEntry(row,{...nav,date},plans,today)).length:null,eventCount=events?.filter(e=>e.date===date).length;
       const active=bars.filter(b=>b.startISO<=date&&b.endISO>=date).sort((a,b)=>(lanes.get(a.id)??0)-(lanes.get(b.id)??0));
       return <button type="button" key={date} aria-label={`${date} 登録納期${count===null?"件数未確認":`${count}件`}${events===undefined?"":` 個人予定${eventCount===undefined?"未確認":`${eventCount}件`}`}${active.length?` 工程予定${active.length}件`:""}`} aria-pressed={date===nav.date} onClick={()=>onChange({...nav,date})} className={`min-h-11 min-w-0 rounded-lg border py-1 ${date===nav.date?"border-pink-400 bg-pink-50 text-pink-900":"border-zinc-200 bg-white"}`}><span className="block">{Number(date.slice(8))}</span><span className="block text-[10px]">{count===null?"?":count?`${count}件`:"―"}</span>{eventCount?<span className="block text-[10px] text-purple-800">予定{eventCount}</span>:null}
        {active.map(b=><span key={b.id} title={`${b.project.title} · ${CASE_PLAN_STAGE_LABELS[b.stage]}予定 ${b.startISO}〜${b.endISO}`} className={`mt-0.5 block truncate border-y text-[9px] ${colors.get(b.project.id)?.color??""} ${b.endISO<today?"border-dashed opacity-60":""}`} data-plan-lane={lanes.get(b.id)}>{CASE_PLAN_STAGE_LABELS[b.stage]}</span>)}
       </button>;})}
    </div>
    {colors.size?<ul aria-label="色と案件" className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-700">{[...colors].map(([id,c])=><li key={id} className="flex min-w-0 items-center gap-1.5"><span aria-hidden="true" className={`inline-block h-2.5 w-4 shrink-0 rounded-sm border ${c.color}`}/><span className="truncate">{c.title}</span></li>)}</ul>:null}
    <p className="text-xs leading-5 text-zinc-600">数字は納期の件数です。帯の色は案件ごと、点線は過ぎた予定、紫はあなたの予定です。</p>
  </section>;
}
