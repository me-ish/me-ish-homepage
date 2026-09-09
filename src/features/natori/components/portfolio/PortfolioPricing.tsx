"use client";

// features/natori/components/portfolio/PortfolioPricing.tsx
// コミッション料金。通常プランはスマホで一覧性を優先してコンパクトに表示し、
// CTA からフォームへスクロールしつつ依頼種別 / 制作範囲を自動で合わせる。
import {
  PLAN_SELECT_EVENT,
  portfolioPlanSelectDetail,
  portfolioColors as c,
} from "@/features/natori/constants/portfolioContent";
import { NATORI_MASS_PRODUCTION_BASE_AMOUNT } from "@/features/natori/constants/portfolioPricing";
import { trackNatoriPageEvent } from "@/features/natori/data/pageEvents";
import { NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE } from "@/features/natori/lib/portfolioRequestForm";
import type { PortfolioContent, PortfolioPlan } from "@/features/natori/types/portfolio";

function startingPriceLabel(price: string): string {
  if (!price.includes("円") || /[〜～~]/u.test(price)) return price;
  return `${price}～`;
}

function yen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`;
}

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
  const massProductionPrice = yen(NATORI_MASS_PRODUCTION_BASE_AMOUNT);

  const handleSelectPlan = (plan: PortfolioPlan) => {
    trackNatoriPageEvent("portfolio_primary_cta_click", "pricing");
    trackNatoriPageEvent("portfolio_plan_click", plan.name);
    window.dispatchEvent(
      new CustomEvent(PLAN_SELECT_EVENT, { detail: portfolioPlanSelectDetail(plan) })
    );
  };

  const handleSelectMassProduction = () => {
    trackNatoriPageEvent("portfolio_primary_cta_click", "pricing");
    trackNatoriPageEvent("portfolio_plan_click", "量産イラスト");
    window.dispatchEvent(
      new CustomEvent(PLAN_SELECT_EVENT, {
        detail: {
          id: NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE,
          label: `量産イラスト（${massProductionPrice}）`,
        },
      })
    );
  };

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-5 py-12 md:py-16">
      <h2 className="mb-6 text-center text-2xl font-black md:mb-8 md:text-3xl">
        コミッション料金
      </h2>

      <p className="mb-2 text-sm font-black sm:mb-3">通常イラスト</p>

      {/* スマホ: 料金を1行ずつ見せ、縦スクロールを抑える */}
      <div
        className="overflow-hidden rounded-2xl border sm:hidden"
        style={{ background: c.surface, borderColor: c.borderSubtle }}
      >
        {content.plans.map((plan, index) => (
          <div
            key={plan.id ?? `legacy-mobile-plan-${index}`}
            className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
            style={{ borderColor: c.borderSubtle }}
          >
            <span className="min-w-0 flex-1 font-bold">{plan.name}</span>
            <span className="shrink-0 font-bold" style={{ color: c.accentDisplay }}>
              {startingPriceLabel(plan.price)}
            </span>
            <a
              href="#form"
              onClick={() => handleSelectPlan(plan)}
              className="pf-cute-focus shrink-0 rounded-full border-2 px-3 py-1.5 text-xs font-bold"
              style={{ borderColor: c.borderStrong, color: c.text }}
              aria-label={`${plan.name}を選ぶ`}
            >
              選ぶ
            </a>
          </div>
        ))}
      </div>

      {/* タブレット / PC: 従来のカード表示を維持 */}
      <div className={`hidden gap-6 sm:grid ${gridCols}`}>
        {content.plans.map((plan, index) => (
          <div
            key={plan.id ?? `legacy-plan-${index}`}
            className="relative flex flex-col rounded-2xl p-6"
            style={{ background: c.surface, boxShadow: `0 10px 22px ${c.shadowSoft}` }}
          >
            <h3 className="mb-1 text-lg font-bold">{plan.name}</h3>
            <p className="mb-2 text-2xl font-bold" style={{ color: c.accentDisplay }}>
              {startingPriceLabel(plan.price)}
            </p>
            <div className="mb-6 flex-1">
              <p className="text-sm" style={{ color: c.textSoft }}>
                {plan.desc}
              </p>
              {plan.features.some((feature) => !commonFeatures.includes(feature)) && (
                <ul className="mt-4 space-y-1.5 text-sm">
                  {plan.features
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
              onClick={() => handleSelectPlan(plan)}
              className="pf-cute-focus rounded-full border-2 py-2.5 text-center font-bold"
              style={{ borderColor: c.borderStrong, color: c.text }}
            >
              このプランで相談
            </a>
          </div>
        ))}
      </div>

      {commonFeatures.length > 0 && (
        <div
          className="mx-auto mt-4 flex max-w-3xl items-start gap-3 rounded-xl px-4 py-3 sm:mt-6 sm:items-center"
          style={{ background: c.accentSoft }}
        >
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold sm:text-xs"
            style={{ background: c.surface, color: c.accentText }}
          >
            通常イラスト共通
          </span>
          <p className="text-xs font-medium leading-relaxed sm:text-sm" style={{ color: c.textSoft }}>
            表示価格には、{includedFeatures}が含まれます。
          </p>
        </div>
      )}

      {/* 量産イラストは通常プランと条件が違うため、独立したコンパクト枠で案内する */}
      <div
        className="mx-auto mt-6 max-w-3xl rounded-2xl border-2 px-4 py-4 sm:flex sm:items-center sm:gap-5 sm:px-5"
        style={{ background: c.surface, borderColor: c.accent }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-black">量産イラスト</h3>
            <p className="shrink-0 text-xl font-black" style={{ color: c.accentDisplay }}>
              {startingPriceLabel(massProductionPrice)}
            </p>
          </div>
          <p className="mt-1 text-sm" style={{ color: c.textSoft }}>
            用意されたデザインから制作する、量産向けのイラストプランです。
          </p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: c.textSoft }}>
            ※リテイク・小物・背景は基本料金に含まれません。
          </p>
        </div>

        {content.massProductionIllustrationOpen ? (
          <a
            href="#form"
            onClick={handleSelectMassProduction}
            className="pf-cute-focus mt-3 block shrink-0 rounded-full border-2 px-5 py-2.5 text-center text-sm font-bold sm:mt-0"
            style={{ borderColor: c.actionDisplay, color: c.actionDisplay }}
          >
            このプランで相談
          </a>
        ) : (
          <span
            className="mt-3 block shrink-0 rounded-full px-4 py-2 text-center text-xs font-bold sm:mt-0"
            style={{ background: c.surfaceSubtle, color: c.textSoft }}
          >
            現在受付停止中
          </span>
        )}
      </div>

      {/* 追加オプション */}
      <div
        className="mx-auto mt-8 max-w-3xl rounded-2xl p-4 sm:mt-12 sm:p-6 md:p-8"
        style={{ background: c.surface, boxShadow: `0 10px 22px ${c.shadowSoft}` }}
      >
        <h3 className="mb-3 text-lg font-black md:mb-4 md:text-xl">追加オプション</h3>
        <ul className="divide-y" style={{ borderColor: c.borderSubtle }}>
          {content.options.map((option, index) => (
            <li
              key={option.id ?? `legacy-option-${index}`}
              className="flex items-baseline justify-between gap-4 py-2 text-sm md:py-2.5 md:text-base"
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
