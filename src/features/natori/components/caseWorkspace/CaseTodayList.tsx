"use client";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { natoriAdminUi as ui } from "../../constants/adminUi";
import { workspaceLook as look } from "../../constants/workspaceLook";
import type { CaseTodayDue, CaseTodayItem } from "../../lib/caseTodayList";

const DUE_TONE: Record<CaseTodayDue["tone"], string> = {
  overdue: "bg-[#FF3B30]/10 text-[#D70015]",
  soon: "bg-[#FF9500]/15 text-[#C93400]",
  later: "bg-sky-50 text-sky-800",
  none: "bg-[#F2F2F7] text-[#6E6E73]",
};

/**
 * 「今日やること」。案件一覧のトップと、予定で案件を選んでいない時の右側で同じものを出す。
 * 行全体が案件の該当画面へのリンク。納期は色だけでなく「◯日超過」などの文字でも出す。
 */
export function CaseTodayList({ items, loading = false, headingId, renderLink, className = "" }: {
  items: readonly CaseTodayItem[] | null; loading?: boolean; headingId: string; className?: string;
  renderLink: (item: CaseTodayItem, content: ReactNode, className: string) => ReactNode;
}) {
  return <section aria-labelledby={headingId} className={className}>
    <div className="mb-2 flex flex-wrap items-baseline gap-x-3 px-1">
      <h2 id={headingId} className={`text-[22px] leading-8 ${look.title}`}>今日やること</h2>
      <span className={`text-[13px] ${look.muted}`}>{items === null ? loading ? "読み込み中" : "読み込めませんでした" : `自分の番 ${items.length}件・納期の近い順`}</span>
    </div>
    {items === null ? null : items.length === 0
      ? <p className={`${look.card} text-sm leading-6 ${look.muted}`}>いま自分の番の案件はありません。お客さんの返事を待っているところです。</p>
      : <ol className={look.group}>{items.map(item => <li key={item.id}>{renderLink(item, <>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-6 text-pink-700">{item.action}</span>
          <span className={`mt-0.5 block text-[13px] leading-5 ${look.muted}`}><span className="text-[#1C1C1E]">{item.title}</span> · {item.clientLabel}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-semibold ${DUE_TONE[item.due.tone]}`}>{item.due.label}</span>
          {item.due.date && !item.due.label.includes(item.due.date) ? <span className={`whitespace-nowrap text-[11px] ${look.muted}`}>納期 {item.due.date}</span> : null}
        </span>
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#C7C7CC]" strokeWidth={2.5}/>
      </>, `${look.groupRow} min-h-16 items-center ${ui.focusRing}`)}</li>)}</ol>}
  </section>;
}
