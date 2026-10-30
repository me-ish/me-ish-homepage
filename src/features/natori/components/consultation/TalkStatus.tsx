import { Check, Circle } from "lucide-react";
import TalkOpenButton from "./TalkOpenButton";
import TalkRoughOkButton from "./TalkRoughOkButton";
import { natoriClientUi as ui } from "@/features/natori/constants/clientUi";
import type { TalkBadgeTone, TalkTimeline } from "@/features/natori/types/talk";

const badgeTone: Record<TalkBadgeTone, string> = {
  action: "bg-[#FFF0F6] text-[#BE185D]",
  done: "bg-[#ECFDF3] text-[#166534]",
  wait: "bg-[#FFF7ED] text-[#92400E]",
  muted: "bg-[#F5F3F4] text-[#5F5963]",
};

/** Quote / payment / delivery state shown above the thread; the cards' buttons open the existing pages. */
export default function TalkStatus({ timeline, token }: { timeline: TalkTimeline; token: string }) {
  // Steps can finish in any order; the first unfinished one is where the client is now.
  const current = timeline.steps.find(step => !step.done)?.key;
  return (
    <section aria-labelledby="talk-status-title" className="space-y-3">
      <h2 id="talk-status-title" className={ui.heading}>ご依頼の進み具合</h2>
      <ol className="grid grid-cols-3 rounded-2xl border border-[#F2D9E0] bg-white px-2 py-3 text-sm font-bold leading-5" aria-label="進み具合">
        {timeline.steps.map((step, index) => {
          const isCurrent = step.key === current;
          return (
            <li key={step.key} aria-current={isCurrent ? "step" : undefined}
              className={`relative flex flex-col items-center gap-1.5 text-center ${step.done ? "text-[#166534]" : isCurrent ? "text-[#BE185D]" : ui.muted}`}>
              {index > 0 ? <span aria-hidden className={`absolute right-1/2 top-3 h-0.5 w-full -translate-y-1/2 ${step.done || isCurrent ? "bg-[#F9A8D4]" : "bg-[#F2D9E0]"}`} /> : null}
              <span aria-hidden className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 ${step.done ? "border-[#166534] bg-[#ECFDF3]" : isCurrent ? "border-[#EC4899] bg-[#FFF0F6]" : "border-[#E5DCE0] bg-white"}`}>
                {step.done ? <Check className="h-3.5 w-3.5" /> : isCurrent ? <Circle className="h-2.5 w-2.5 fill-current" /> : null}
              </span>
              <span>{step.label}<span className="sr-only">{step.done ? "（済み）" : "（まだ）"}</span></span>
            </li>
          );
        })}
      </ol>
      <ul className="space-y-3">
        {timeline.cards.map(card => (
          <li key={card.id} className={`rounded-2xl border bg-white p-4 ${card.badge.tone === "action" ? "border-2 border-[#EC4899]" : "border-[#F2D9E0]"}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px] font-bold leading-6">{card.title}</p>
              <span className={`rounded-full px-3 py-0.5 text-[12px] font-bold leading-5 ${badgeTone[card.badge.tone]}`}>{card.badge.label}</span>
            </div>
            {card.amount ? <p className="mt-1 text-[22px] font-bold leading-8">{card.amount}</p> : null}
            {card.lines.map(line => <p key={line} className={`mt-1 ${ui.small} ${ui.muted}`}>{line}</p>)}
            {card.action && "href" in card.action ? <a href={card.action.href} target="_blank" rel="noopener noreferrer" className={`${ui.btnPrimary} mt-3`}>{card.action.label}</a> : null}
            {card.action && "open" in card.action ? <TalkOpenButton token={token} target={card.action.open} label={card.action.label} /> : null}
            {card.action && "roughOk" in card.action ? <TalkRoughOkButton token={token} roughId={card.action.roughOk} label={card.action.label} /> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
