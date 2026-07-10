// features/natori/components/portfolio/PortfolioPricing.tsx
import {
  portfolioColors as c,
  portfolioOptions,
  portfolioPlans,
} from "@/features/natori/constants/portfolioContent";
import { fontEnStyle } from "./portfolioFonts";

export default function PortfolioPricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-5 py-16">
      <h2 className="mb-8 text-center text-2xl font-black md:text-3xl">コミッション料金</h2>

      {/* 基本料金 */}
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
            <p className="mb-2 text-2xl font-bold" style={{ color: c.pinkDeep }}>
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

      {/* 追加オプション */}
      <div
        className="mx-auto mt-12 max-w-3xl rounded-2xl p-6 md:p-8"
        style={{ background: c.card, boxShadow: "0 10px 22px rgba(45,42,61,0.10)" }}
      >
        <h3 className="mb-4 text-lg font-black md:text-xl">追加オプション</h3>
        <ul className="divide-y" style={{ borderColor: c.paperAlt }}>
          {portfolioOptions.map((option) => (
            <li
              key={option.name}
              className="flex items-baseline justify-between gap-4 py-2.5 text-sm md:text-base"
              style={{ borderColor: c.paperAlt }}
            >
              <span style={{ color: c.inkSoft }}>{option.name}</span>
              <span className="shrink-0 font-bold" style={{ color: c.pinkDeep }}>
                {option.price}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
