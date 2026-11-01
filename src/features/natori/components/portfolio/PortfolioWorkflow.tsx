// 制作の流れと納期。購入者へのお願いとは意思決定順に合わせて分離する。
import { ChevronDown } from "lucide-react";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import { workflowStepView } from "@/features/natori/lib/portfolioStepText";
import { resolvePortfolioWorkflow } from "@/features/natori/lib/portfolioWorkflow";
import type { PortfolioDisplayContent } from "@/features/natori/types/portfolioDisplay";


export default function PortfolioWorkflow({ content }: { content: PortfolioDisplayContent }) {
  const workflow = resolvePortfolioWorkflow(content.workflow, content.workflowProjectionAllowed !== false);

  return (
    <section id="flow" className="pb-6 pt-16 md:py-16" style={{ background: c.surfaceSubtle }}>
      <div className="mx-auto max-w-4xl space-y-10 px-5">
        <div>
          <h2 className="mb-6 text-center text-2xl font-black md:text-3xl"><span className="pf-marker">制作の流れ</span></h2>
          {/* 番号の丸を縦の線でつないだ時系列。各 li の線は次の丸まで伸ばし、最後の項目だけ線を引かない */}
          <ol>
            {workflow.map((step, index) => (
              <li
                key={`${step.title}-${index}`}
                className="relative flex items-start gap-4 pb-8 last:pb-0 md:gap-5"
              >
                <span
                  className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-base font-black"
                  style={{
                    background: c.action,
                    borderColor: c.action,
                    color: c.onAction,
                  }}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                {index < workflow.length - 1 ? (
                  <span
                    className="absolute bottom-0 left-5 top-10 w-0 -translate-x-1/2 border-l-2 border-dashed"
                    style={{ borderColor: c.formBorder }}
                    aria-hidden="true"
                  />
                ) : null}
                <WorkflowStepCard title={step.title} body={step.body} />
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h2 className="mb-6 text-center text-2xl font-black md:text-3xl"><span className="pf-marker">納期について</span></h2>
          <div className="pf-sketch p-6 md:p-8">
            <p className="mb-5 leading-relaxed" style={{ color: c.textSoft }}>
              {content.deliveryLead}
            </p>
            <dl className="space-y-4">
              {content.deliveryNotes.map((note, index) => (
                <div key={`${note.title}-${index}`}>
                  <dt className="mb-1 flex items-center gap-2 font-bold">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: c.accent }}
                      aria-hidden="true"
                    />
                    {note.title}
                  </dt>
                  <dd className="pl-4 text-sm leading-relaxed" style={{ color: c.textSoft }}>
                    {note.body}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * 各ステップは短い説明だけを見せ、全文はカードを押すと開く。文面は削らない。
 * 開く合図は説明の最終行の末尾に↓だけ置き、専用の行を増やさない。
 */
function WorkflowStepCard({ title, body }: { title: string; body: string }) {
  const { lead, detail } = workflowStepView({ title, body });
  if (!detail) {
    return (
      <div className="min-w-0 flex-1 pt-1.5 md:pt-2">
        <p className="mb-1 font-bold">{title}</p>
        <p className="text-sm leading-relaxed" style={{ color: c.textSoft }}>
          {lead}
        </p>
      </div>
    );
  }
  return (
    <details className="group min-w-0 flex-1">
      <summary className="pf-cute-focus block cursor-pointer list-none rounded-2xl pt-1.5 md:pt-2 [&::-webkit-details-marker]:hidden">
        <p className="mb-1 font-bold">{title}</p>
        <p className="text-sm leading-relaxed" style={{ color: c.textSoft }}>
          <span className="group-open:hidden">{lead}</span>
          <span className="hidden group-open:inline">{detail}</span>
          <ChevronDown
            aria-hidden="true"
            className="ml-1 inline-block h-4 w-4 align-[-3px] transition-transform group-open:rotate-180 motion-reduce:transition-none"
            style={{ color: c.actionTextSmall }}
          />
        </p>
      </summary>
    </details>
  );
}
