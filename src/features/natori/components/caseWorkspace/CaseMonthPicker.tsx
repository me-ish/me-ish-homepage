"use client";
import type { CaseWorkspaceLocation } from "../../lib/caseWorkspaceNavigation";
import { caseMonthDays, matchesCaseEntry } from "../../lib/caseWorkspaceEntries";
import type { CaseWorkspaceRecord } from "../../types/caseWorkspace";
import type {CasePersonalEvent} from "../../types/caseEntryIndex";
import type {CasePlanning} from "../../lib/caseScreenContext";
import {casePlannedBars,CASE_PLAN_STAGE_LABELS} from "../../lib/casePlanning";
import {assignBarLanes} from "../../lib/projects";

export function CaseMonthPicker({nav,records,available,onChange,events,plans=null,today=nav.date}:{nav:CaseWorkspaceLocation;records:readonly CaseWorkspaceRecord[];available:boolean;onChange:(next:CaseWorkspaceLocation)=>void;events?:readonly CasePersonalEvent[]|null;plans?:CasePlanning|null;today?:string}) {
  const days=caseMonthDays(nav.month), start=days[0]?new Date(`${days[0]}T00:00:00Z`).getUTCDay():0;
  const bars=available?records.filter(r=>matchesCaseEntry(r,{...nav,entry:"cases"})).flatMap(r=>casePlannedBars(r,plans,today)):[],lanes=assignBarLanes(bars);
  return <section aria-label="登録納期のカレンダー" className="space-y-2">
    <label className="block text-xs font-semibold text-zinc-600">表示月<input type="month" value={nav.month} onChange={e=>{if(caseMonthDays(e.target.value).length)onChange({...nav,month:e.target.value});}} className="mt-1 h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm"/></label>
    <div className="grid grid-cols-7 gap-1 text-center text-xs">
      {["日","月","火","水","木","金","土"].map(day=><span key={day} className="py-1 text-zinc-500">{day}</span>)}
      {Array.from({length:start},(_,i)=><span key={`blank-${i}`}/>)}
      {days.map(date=>{const count=available?records.filter(row=>row.registeredDueDate===date&&matchesCaseEntry(row,{...nav,date},plans,today)).length:null,eventCount=events?.filter(e=>e.date===date).length;
       const active=bars.filter(b=>b.startISO<=date&&b.endISO>=date).sort((a,b)=>(lanes.get(a.id)??0)-(lanes.get(b.id)??0));
       return <button type="button" key={date} aria-label={`${date} 登録納期${count===null?"件数未確認":`${count}件`}${events===undefined?"":` 個人予定${eventCount===undefined?"未確認":`${eventCount}件`}`}${active.length?` 工程予定${active.length}件`:""}`} aria-pressed={date===nav.date} onClick={()=>onChange({...nav,date})} className={`min-h-11 min-w-0 rounded-lg border py-1 ${date===nav.date?"border-pink-400 bg-pink-50 text-pink-900":"border-zinc-200 bg-white"}`}><span className="block">{Number(date.slice(8))}</span><span className="block text-[10px]">{count===null?"?":count?`${count}件`:"―"}</span>{eventCount?<span className="block text-[10px] text-purple-800">予定{eventCount}</span>:null}
        {active.map(b=><span key={b.id} title={`${b.project.title} · ${CASE_PLAN_STAGE_LABELS[b.stage]}予定 ${b.startISO}〜${b.endISO}`} className={`mt-0.5 block truncate border-y text-[9px] ${b.endISO<today?"border-amber-300 bg-amber-50":"border-blue-200 bg-blue-50"}`} data-plan-lane={lanes.get(b.id)}>{CASE_PLAN_STAGE_LABELS[b.stage]}</span>)}
       </button>;})}
    </div>
    <p className="text-xs leading-5 text-zinc-600">数字は登録納期、青い帯は計算上の工程予定、紫は個人予定です。契約期限・実際の完了とは別です。日を選ぶと重なった案件を確認できます。</p>
  </section>;
}
