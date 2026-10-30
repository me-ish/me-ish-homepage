"use client";
import type { ReactNode } from "react";
import type { CaseStep, CaseStepKey } from "../../lib/caseSteps";
import { workspaceLook as look } from "../../constants/workspaceLook";

type StepLink = (step: CaseStep, content: ReactNode, className: string, attributes: Record<string, string | undefined>) => ReactNode;

/**
 * Vertical step view. The open step's work area sits right under that step; the
 * area keeps one position in the tree so drafts inside it survive step changes.
 */
export function CaseStepList({ steps, selected, link, sheet = null, trailing = false, bare = false, children }: {
  steps: readonly CaseStep[]; selected: CaseStepKey | null; link: StepLink; children: ReactNode;
  /** No step is open and the work area comes first, with every step listed after it. */
  trailing?: boolean;
  /** Only the work area, with no steps around it (the トーク tab's chat view). The tree stays the same so drafts survive. */
  bare?: boolean;
  /** On phones the work area opens as a bottom sheet over the steps instead of under one step. */
  sheet?: { close: ReactNode; backdrop: ReactNode; onEscape: () => void } | null;
}) {
  const shown = bare ? [] : steps;
  const cut = trailing || bare ? 0 : selected && !sheet ? steps.findIndex(step => step.key === selected) + 1 : steps.length;
  const row = (step: CaseStep, index: number) => {
    const open = step.key === selected && !sheet, last = index === steps.length - 1;
    const dot = step.state === "done" ? "bg-sky-600 text-white" : step.state === "current" ? "bg-pink-600 text-white ring-4 ring-pink-200" : "border-[1.5px] border-dashed border-zinc-300 bg-white text-zinc-500";
    return <li key={step.key} className="relative pb-2">
      {!last && !(open && index === cut - 1) ? <span aria-hidden="true" className="absolute bottom-0 left-[15px] top-8 border-l-2 border-dashed border-zinc-300" /> : null}
      {link(step, <>
        <span aria-hidden="true" className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${dot}`}>{step.state === "done" ? "✓" : index + 1}</span>
        <span className="min-w-0 flex-1">
          <span className={`flex items-center justify-between gap-2 ${look.zen} text-[15px] font-bold leading-8 ${step.state === "upcoming" ? "text-zinc-500" : "text-zinc-900"}`}>
            <span>{step.label}<span className="sr-only">{step.state === "done" ? "（済み）" : step.state === "current" ? "（いまの段階）" : "（これから）"}</span></span>
            {!open && step.state !== "upcoming" ? <span aria-hidden="true" className="text-sm text-zinc-400">›</span> : null}
          </span>
          {step.summary ? <span className="-mt-1 block text-xs leading-5 text-zinc-500">{step.summary}</span> : null}
        </span>
      </>, `flex min-h-11 items-start gap-3 rounded-xl pr-1 ${open ? "" : "hover:bg-white"}`, { "aria-current": open ? "step" : undefined })}
    </li>;
  };
  return <section aria-label={bare ? undefined : "案件の段階"} className="mb-5">
    <ol key="before" className="list-none">{shown.slice(0, cut).map((step, index) => row(step, index))}</ol>
    {sheet ? sheet.backdrop : null}
    <div key="work" onKeyDown={sheet ? event => { if (event.key === "Escape") sheet.onEscape(); } : undefined}
      className={sheet ? "fixed inset-x-0 bottom-0 z-40 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 shadow-2xl lg:static lg:z-auto lg:mb-3 lg:max-h-none lg:overflow-visible lg:rounded-[22px_16px_24px_15px] lg:border-2 lg:border-[#3B2F33] lg:p-5 lg:shadow-[4px_4px_0_#FBCFE8]"
        : bare ? `p-3 sm:p-5 ${look.work}` : selected ? `mb-3 p-3 sm:p-5 ${look.work}` : trailing ? "mb-6" : "mt-2"}>
      {sheet ? <div className="mb-2 flex items-center justify-between gap-3"><span aria-hidden="true" className="mx-auto h-1.5 w-10 rounded-full bg-zinc-300 lg:hidden" /></div> : null}
      {sheet ? <div className="float-right ml-3">{sheet.close}</div> : null}
      {children}</div>
    {trailing && !bare ? <h2 className={`mb-2 text-[14px] text-zinc-600 ${look.title}`}>段階</h2> : null}
    <ol key="after" start={cut + 1} className="list-none">{shown.slice(cut).map((step, index) => row(step, cut + index))}</ol>
  </section>;
}
