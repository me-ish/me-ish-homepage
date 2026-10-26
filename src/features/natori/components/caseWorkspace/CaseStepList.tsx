"use client";
import type { ReactNode } from "react";
import type { CaseStep, CaseStepKey } from "../../lib/caseSteps";

type StepLink = (step: CaseStep, content: ReactNode, className: string, attributes: Record<string, string | undefined>) => ReactNode;

/**
 * Vertical step view. The open step's work area sits right under that step; the
 * area keeps one position in the tree so drafts inside it survive step changes.
 */
export function CaseStepList({ steps, selected, link, children }: {
  steps: readonly CaseStep[]; selected: CaseStepKey | null; link: StepLink; children: ReactNode;
}) {
  const cut = selected ? steps.findIndex(step => step.key === selected) + 1 : steps.length;
  const row = (step: CaseStep, index: number) => {
    const open = step.key === selected, last = index === steps.length - 1;
    const dot = step.state === "done" ? "bg-zinc-900 text-white" : step.state === "current" ? "bg-pink-500 text-white ring-4 ring-pink-100" : "bg-zinc-200 text-zinc-500";
    return <li key={step.key} className="relative pb-2">
      {!last && !(open && index === cut - 1) ? <span aria-hidden="true" className="absolute bottom-0 left-[15px] top-8 w-0.5 bg-zinc-200" /> : null}
      {link(step, <>
        <span aria-hidden="true" className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${dot}`}>{step.state === "done" ? "✓" : index + 1}</span>
        <span className="min-w-0 flex-1">
          <span className={`flex items-center justify-between gap-2 text-[15px] font-semibold leading-8 ${step.state === "upcoming" ? "text-zinc-400" : "text-zinc-900"}`}>
            <span>{step.label}<span className="sr-only">{step.state === "done" ? "（済み）" : step.state === "current" ? "（いまの段階）" : "（これから）"}</span></span>
            {!open && step.state !== "upcoming" ? <span aria-hidden="true" className="text-sm text-zinc-400">›</span> : null}
          </span>
          {step.summary ? <span className="-mt-1 block text-xs leading-5 text-zinc-500">{step.summary}</span> : null}
        </span>
      </>, `flex min-h-11 items-start gap-3 rounded-xl pr-1 ${open ? "" : "hover:bg-white"}`, { "aria-current": open ? "step" : undefined })}
    </li>;
  };
  return <section aria-label="案件の段階" className="mb-5">
    <ol key="before" className="list-none">{steps.slice(0, cut).map((step, index) => row(step, index))}</ol>
    <div key="work" className={selected ? "mb-3 rounded-2xl border-2 border-pink-200 bg-white p-3 sm:p-5" : "mt-2"}>{children}</div>
    <ol key="after" start={cut + 1} className="list-none">{steps.slice(cut).map((step, index) => row(step, cut + index))}</ol>
  </section>;
}
