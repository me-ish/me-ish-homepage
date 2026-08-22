// 制作の流れと納期。購入者へのお願いとは意思決定順に合わせて分離する。
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import type { PortfolioContent } from "@/features/natori/types/portfolio";

const cardStyle = {
  background: c.surface,
  boxShadow: `0 10px 22px ${c.shadowSoft}`,
} as const;

export default function PortfolioWorkflow({ content }: { content: PortfolioContent }) {
  return (
    <section id="flow" className="py-16" style={{ background: c.surfaceSubtle }}>
      <div className="mx-auto max-w-4xl space-y-10 px-5">
        <div>
          <h2 className="mb-6 text-center text-2xl font-black md:text-3xl">制作の流れ</h2>
          <ol className="space-y-4">
            {content.workflow.map((step, index) => (
              <li
                key={`${step.title}-${index}`}
                className="flex items-start gap-4 rounded-2xl p-5"
                style={cardStyle}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                  style={{ background: c.action, color: c.onAction }}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <div>
                  <p className="mb-1 font-bold">{step.title}</p>
                  <p className="text-sm leading-relaxed" style={{ color: c.textSoft }}>
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h2 className="mb-6 text-center text-2xl font-black md:text-3xl">納期について</h2>
          <div className="rounded-2xl p-6 md:p-8" style={cardStyle}>
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
