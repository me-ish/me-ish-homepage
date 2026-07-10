// features/natori/components/portfolio/PortfolioPricing.tsx
import {
  portfolioColors as c,
  portfolioPlans,
} from "@/features/natori/constants/portfolioContent";
import { fontEnStyle } from "./portfolioFonts";

export default function PortfolioPricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-5 py-16">
      <h2 className="mb-8 text-center text-2xl font-black md:text-3xl">コミッション料金</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {portfolioPlans.map((p) => (
          <div
            key={p.name}
            className="relative flex flex-col rounded-2xl p-6"
            style={{ background: c.card, boxShadow: "0 10px 22px rgba(45,42,61,0.10)" }}
          >
            {p.badge && (
              <span
                className="absolute -top-3 right-4 rounded-full px-3 py-1 text-xs font-bold shadow"
                style={{ ...fontEnStyle, background: c.yellow, color: c.ink }}
              >
                {p.badge}
              </span>
            )}
            <div className="mb-4 h-10 w-10 rounded-full" style={{ background: p.color }} aria-hidden="true" />
            <h3 className="mb-1 text-lg font-bold">{p.name}</h3>
            <p className="mb-2 text-2xl font-bold" style={{ ...fontEnStyle, color: c.pinkDeep }}>
              {p.price}
            </p>
            <p className="mb-4 text-sm" style={{ color: c.inkSoft }}>
              {p.desc}
            </p>
            <ul className="mb-6 flex-1 space-y-1.5 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span style={{ color: c.mintDeep }} aria-hidden="true">
                    ✓
                  </span>
                  <span style={{ color: c.inkSoft }}>{f}</span>
                </li>
              ))}
            </ul>
            <a
              href="#form"
              className="pf-cute-focus rounded-full border-2 py-2.5 text-center font-bold"
              style={{ borderColor: p.color, color: c.ink }}
            >
              このプランで相談
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
