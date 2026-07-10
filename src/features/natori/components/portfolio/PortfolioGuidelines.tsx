// features/natori/components/portfolio/PortfolioGuidelines.tsx
// 納期について・制作の流れ・購入者へのお願い
import {
  portfolioColors as c,
  portfolioDeliveryLead,
  portfolioDeliveryNotes,
  portfolioRequests,
  portfolioWorkflow,
} from "@/features/natori/constants/portfolioContent";

const cardStyle = {
  background: c.card,
  boxShadow: "0 10px 22px rgba(45,42,61,0.10)",
} as const;

export default function PortfolioGuidelines() {
  return (
    <section id="flow" className="py-16" style={{ background: c.paperAlt }}>
      <div className="mx-auto max-w-4xl space-y-10 px-5">
        {/* 制作の流れ */}
        <div>
          <h2 className="mb-6 text-center text-2xl font-black md:text-3xl">制作の流れ</h2>
          <ol className="space-y-4">
            {portfolioWorkflow.map((step, index) => (
              <li key={step.title} className="flex items-start gap-4 rounded-2xl p-5" style={cardStyle}>
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: c.pink }}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <div>
                  <p className="mb-1 font-bold">{step.title}</p>
                  <p className="text-sm leading-relaxed" style={{ color: c.inkSoft }}>
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* 納期について */}
        <div>
          <h2 className="mb-6 text-center text-2xl font-black md:text-3xl">納期について</h2>
          <div className="rounded-2xl p-6 md:p-8" style={cardStyle}>
            <p className="mb-5 leading-relaxed" style={{ color: c.inkSoft }}>
              {portfolioDeliveryLead}
            </p>
            <dl className="space-y-4">
              {portfolioDeliveryNotes.map((note) => (
                <div key={note.title}>
                  <dt className="mb-1 flex items-center gap-2 font-bold">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: c.mint }}
                      aria-hidden="true"
                    />
                    {note.title}
                  </dt>
                  <dd className="pl-4 text-sm leading-relaxed" style={{ color: c.inkSoft }}>
                    {note.body}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* 購入者へのお願い */}
        <div>
          <h2 className="mb-6 text-center text-2xl font-black md:text-3xl">購入者へのお願い</h2>
          <ul className="space-y-1.5 rounded-2xl p-6 text-sm md:p-8 md:text-base" style={cardStyle}>
            {portfolioRequests.map((request) => (
              <li key={request} className="flex items-start gap-2">
                <span style={{ color: c.pinkDeep }} aria-hidden="true">
                  ♥
                </span>
                <span style={{ color: c.inkSoft }}>{request}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
