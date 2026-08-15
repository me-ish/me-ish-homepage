"use client";

// features/natori/components/portfolio/PortfolioPricing.tsx
// コミッション料金。「このプランで相談」はフォームへスクロールしつつ、
// フォームの「サイズ / プラン」をそのプランに自動で合わせる。
import {
  PLAN_SELECT_EVENT,
  portfolioPlanSelectDetail,
  portfolioColors as c,
} from "@/features/natori/constants/portfolioContent";
import { trackNatoriPageEvent } from "@/features/natori/data/pageEvents";
import type { PortfolioContent, PortfolioPlan } from "@/features/natori/types/portfolio";

export default function PortfolioPricing({ content }: { content: PortfolioContent }) {
  const gridCols =
    content.plans.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";
  const commonFeatures =
    content.plans.length > 0
      ? content.plans[0].features.filter((feature) =>
          content.plans.every((plan) => plan.features.includes(feature))
        )
      : [];
  const includedFeatures = commonFeatures
    .map((feature) => feature.replace(/無料[。．.]?$/u, "").trim())
    .join("、");

  const handleSelectPlan = (plan: PortfolioPlan) => {
    trackNatoriPageEvent("portfolio_primary_cta_click", "pricing");
    trackNatoriPageEvent("portfolio_plan_click", plan.name);
    window.dispatchEvent(
      new CustomEvent(PLAN_SELECT_EVENT, { detail: portfolioPlanSelectDetail(plan) })
    );
  };

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-5 py-16">
      <h2
        className={`text-center text-2xl font-black md:text-3xl ${
          commonFeatures.length > 0 ? "mb-5" : "mb-8"
        }`}
      >
        コミッション料金
      </h2>

      {commonFeatures.length > 0 && (
        <div
          className="mx-auto mb-8 flex max-w-3xl flex-col items-center gap-2 rounded-2xl border px-5 py-4 text-center sm:flex-row sm:justify-center sm:gap-4 sm:text-left"
          style={{ background: c.accentSoft, borderColor: c.borderSubtle }}
        >
          <span
            className="shrink-0 rounded-full px-3 py-1 text-xs font-bold"
            style={{ background: c.surface, color: c.accentText }}
          >
            全プラン共通
          </span>
          <p className="text-sm font-medium" style={{ color: c.textSoft }}>
            表示価格には、{includedFeatures}が含まれます。
          </p>
        </div>
      )}

      {/* 基本料金 */}
      <div className={`grid gap-6 ${gridCols}`}>
        {content.plans.map((p, index) => (
          <div
            key={p.id ?? `legacy-plan-${index}`}
            className="relative flex flex-col rounded-2xl p-6"
            style={{ background: c.surface, boxShadow: "0 10px 22px rgba(36,36,36,0.08)" }}
          >
            <h3 className="mb-1 text-lg font-bold">{p.name}</h3>
            <p className="mb-2 text-2xl font-bold" style={{ color: c.accentDisplay }}>
              {p.price}
            </p>
            <div className="mb-6 flex-1">
              <p className="text-sm" style={{ color: c.textSoft }}>
                {p.desc}
              </p>
              {p.features.some((feature) => !commonFeatures.includes(feature)) && (
                <ul className="mt-4 space-y-1.5 text-sm">
                  {p.features
                    .filter((feature) => !commonFeatures.includes(feature))
                    .map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <span style={{ color: c.success }} aria-hidden="true">
                          ✓
                        </span>
                        <span style={{ color: c.textSoft }}>{feature}</span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
            <a
              href="#form"
              onClick={() => handleSelectPlan(p)}
              className="pf-cute-focus rounded-full border-2 py-2.5 text-center font-bold"
              style={{ borderColor: c.borderStrong, color: c.text }}
            >
              このプランで相談
            </a>
          </div>
        ))}
      </div>

      {/* 追加オプション */}
      <div
        className="mx-auto mt-12 max-w-3xl rounded-2xl p-6 md:p-8"
        style={{ background: c.surface, boxShadow: "0 10px 22px rgba(36,36,36,0.08)" }}
      >
        <h3 className="mb-4 text-lg font-black md:text-xl">追加オプション</h3>
        <ul className="divide-y" style={{ borderColor: c.borderSubtle }}>
          {content.options.map((option, index) => (
            <li
              key={option.id ?? `legacy-option-${index}`}
              className="flex items-baseline justify-between gap-4 py-2.5 text-sm md:text-base"
              style={{ borderColor: c.borderSubtle }}
            >
              <span style={{ color: c.textSoft }}>{option.name}</span>
              <span className="shrink-0 font-bold" style={{ color: c.accentText }}>
                {option.price}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
