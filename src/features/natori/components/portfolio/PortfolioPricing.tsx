"use client";

// features/natori/components/portfolio/PortfolioPricing.tsx
// コミッション料金。通常プランはスマホでも説明を確認しつつ比較しやすい密度で表示し、
// CTA からフォームへスクロールしつつ依頼種別 / 制作範囲を自動で合わせる。
import { ChevronDown } from "lucide-react";
import { PORTFOLIO_OPTION_IDS, planChoiceLabel, portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import { NATORI_MASS_PRODUCTION_BASE_AMOUNT } from "@/features/natori/constants/portfolioPricing";
import { trackNatoriPageEvent } from "@/features/natori/data/pageEvents";
import { portfolioPlanSample } from "@/features/natori/lib/portfolioPlanSamples";
import { NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE } from "@/features/natori/lib/portfolioRequestForm";
import type { PortfolioContent, PortfolioPlan } from "@/features/natori/types/portfolio";

function startingPriceLabel(price: string): string {
  if (!price.includes("円") || /[〜～~]/u.test(price)) return price;
  return `${price}～`;
}

function yen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`;
}

function planDescription(description: string): string {
  return description === "膝〜腰上までのフルカラーイラスト"
    ? "膝・腰上から上のフルカラーイラスト"
    : description;
}

export default function PortfolioPricing({ content, contactPath = "/natori/portfolio/contact", structuredIntake = false }: { content: PortfolioContent; contactPath?: string; structuredIntake?: boolean }) {
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
  const massProductionSamples = (content.massProductionSamples ?? []).filter(
    (sample) => Boolean(sample.image)
  );
  // 作例は編集画面でプランごとに選んだ作品。1つでもあれば、PC のカードは全プランに同じ高さの枠を取る。
  const planSamples = content.plans.map((plan) => portfolioPlanSample(plan, content.works));
  const hasPlanSamples = planSamples.some((sample) => sample !== null);

  const trackPlan = (name: string) => {
    trackNatoriPageEvent("portfolio_primary_cta_click", "pricing");
    trackNatoriPageEvent("portfolio_plan_click", name);
  };
  const planHref = (plan: PortfolioPlan) => `${contactPath}?mode=quote${plan.id ? `&plan=${encodeURIComponent(plan.id)}` : `&planLabel=${encodeURIComponent(planChoiceLabel(plan))}`}${structuredIntake ? "&structured=1" : ""}`;

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-5 pb-12 pt-6 md:py-16">
      <h2 className="mb-6 text-center text-2xl font-black md:mb-8 md:text-3xl">
        <span className="pf-marker">コミッション料金</span>
      </h2>

      <p className="mb-2 text-sm font-black sm:mb-3">通常イラスト</p>

      {/* プランの違いは描く範囲と料金だけなので、全プラン共通で含まれるものはカードの前に1回だけ出す */}
      {commonFeatures.length > 0 && (
        <div
          className="mx-auto mb-2 flex max-w-3xl items-start gap-2 rounded-xl px-3 py-2 sm:mb-3 sm:items-center sm:gap-3 sm:px-4 sm:py-3"
          style={{ background: c.surfaceSubtle }}
        >
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-sm font-bold sm:px-2.5 sm:py-1"
            style={{ background: c.surface, color: c.actionTextSmall }}
          >
            通常イラスト共通
          </span>
          <p className="text-sm font-medium leading-5 sm:text-sm sm:leading-relaxed" style={{ color: c.textSoft }}>
            表示価格には、{includedFeatures}が含まれます。
          </p>
        </div>
      )}


      {/* スマホ: 作例は一覧の上に並べ、描く範囲の違いを見比べられるようにする */}
      {hasPlanSamples ? (
        <div role="group" aria-label="通常イラストの作例" className="mb-3 flex flex-wrap justify-center gap-2 sm:hidden">
          {content.plans.map((plan, index) => {
            const sample = planSamples[index];
            return sample ? (
              <figure key={plan.id ?? `legacy-sample-${index}`} className="w-[calc(25%-0.375rem)] min-w-0">
                {/* アップロード画像は公開Storage URLなので next/image のhost設定に依存させない */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sample.image}
                  alt={`${plan.name}の作例「${sample.title}」`}
                  loading="lazy"
                  className="aspect-[4/5] w-full rounded-lg border object-contain"
                  style={{ borderColor: c.borderSubtle, background: c.surfaceSubtle }}
                />
                <figcaption
                  className="mt-1 text-center text-sm font-bold leading-tight [overflow-wrap:anywhere]"
                  style={{ color: c.textSoft }}
                >
                  {plan.name}
                </figcaption>
              </figure>
            ) : null;
          })}
        </div>
      ) : null}

      {/* スマホ: 2段構成で説明を残しつつ、複数プランを比較しやすい密度にする */}
      <ul
        aria-label="通常イラスト料金（スマホ）"
        className="pf-sketch overflow-hidden sm:hidden"
      >
        {content.plans.map((plan, index) => {
          const planSpecificFeatures = plan.features.filter(
            (feature) => !commonFeatures.includes(feature)
          );

          return (
            <li
              key={plan.id ?? `legacy-mobile-plan-${index}`}
              className="border-b px-4 py-2 last:border-b-0"
              style={{ borderColor: c.borderSubtle }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="min-w-0 font-bold">{plan.name}</h3>
                <span className="shrink-0 font-bold" style={{ color: c.text }}>
                  {startingPriceLabel(plan.price)}
                </span>
              </div>

              <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="min-w-0">
                  {/* スマホでも 13px。切らずに折り返して、説明を最後まで読めるようにする */}
                  <p className="text-sm leading-5" style={{ color: c.textSoft }}>
                    {planDescription(plan.desc)}
                  </p>
                  {planSpecificFeatures.length > 0 ? (
                    <ul className="mt-0.5 space-y-0.5 text-sm leading-5">
                      {planSpecificFeatures.map((feature) => (
                        <li key={feature} className="flex items-start gap-1.5">
                          <span style={{ color: c.actionText }} aria-hidden="true">
                            ✓
                          </span>
                          <span style={{ color: c.textSoft }}>
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <a
                  href={planHref(plan)}
                  onClick={() => trackPlan(plan.name)}
                  className="pf-btn pf-btn-sm pf-cute-focus inline-flex min-h-11 shrink-0 items-center justify-center px-3 py-1 text-sm font-bold"
                  style={{ borderColor: c.actionDisplay, color: c.text, background: c.surface }}
                  aria-label={`${plan.name}を選ぶ`}
                >
                  このプランで相談
                </a>
              </div>
            </li>
          );
        })}
      </ul>

      {/* タブレット / PC: カードを並べず、1枚の「お品書き」として縦に読む。作例は行の左に小さく添える。 */}
      <ul
        aria-label="通常イラスト料金"
        className="pf-sketch mx-auto hidden max-w-3xl divide-y divide-[#F2D9E0] sm:block"
      >
        {content.plans.map((plan, index) => {
          const sample = planSamples[index];
          const planSpecificFeatures = plan.features.filter((feature) => !commonFeatures.includes(feature));
          return (
            <li
              key={plan.id ?? `legacy-plan-${index}`}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-5 px-5 py-4 md:px-7"
              style={{ borderColor: c.borderSubtle }}
            >
              {hasPlanSamples ? (
                sample ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sample.image}
                    alt={`${plan.name}の作例「${sample.title}」`}
                    loading="lazy"
                    className="pf-sketch-soft h-24 w-[4.8rem] object-contain md:h-28 md:w-[5.6rem]"
                    style={{ background: c.surfaceSubtle }}
                  />
                ) : (
                  // 作例のないプランは空枠を見せず、幅だけ取って名前と金額の位置をそろえる
                  <span aria-hidden="true" data-plan-sample-spacer className="w-[4.8rem] md:w-[5.6rem]" />
                )
              ) : (
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: c.action }} />
              )}
              <div className="min-w-0">
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="mt-0.5 text-sm" style={{ color: c.textSoft }}>
                  {planDescription(plan.desc)}
                </p>
                {planSpecificFeatures.length > 0 ? (
                  <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {planSpecificFeatures.map((feature) => (
                      <li key={feature} className="flex items-start gap-1.5">
                        <span style={{ color: c.actionText }} aria-hidden="true">✓</span>
                        <span style={{ color: c.textSoft }}>{feature}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <p className="text-2xl font-bold tabular-nums" style={{ color: c.text }}>
                  {startingPriceLabel(plan.price)}
                </p>
                <a
                  href={planHref(plan)}
                  onClick={() => trackPlan(plan.name)}
                  className="pf-btn pf-btn-sm pf-cute-focus inline-flex min-h-10 items-center px-4 text-sm font-bold"
                  style={{ borderColor: c.actionDisplay, color: c.text, background: c.surface }}
                >
                  このプランで相談
                </a>
              </div>
            </li>
          );
        })}
      </ul>

      {/* 受付停止中は説明や作例を出さず、1行だけで知らせる */}
      {content.massProductionIllustrationOpen ? (
        <div
          className="pf-sketch-soft mx-auto mt-6 max-w-3xl px-4 py-4 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-5 sm:px-5"
        >
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-black">量産イラスト</h3>
              <p className="shrink-0 text-xl font-black" style={{ color: c.text }}>
                {startingPriceLabel(massProductionPrice)}
              </p>
            </div>
            <p className="mt-1 text-sm" style={{ color: c.textSoft }}>
              用意されたデザインから制作する、量産向けのイラストプランです。
            </p>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: c.textSoft }}>
              ※量産イラストのため、原則としてリテイクはお受けしておりません。
            </p>

            {massProductionSamples.length > 0 ? (
              <div
                role="group"
                aria-label="量産イラスト作例"
                className={`mx-auto mt-3 grid gap-2 sm:mx-0 sm:gap-3 ${
                  massProductionSamples.length === 1
                    ? "max-w-[9rem] grid-cols-1"
                    : "max-w-[18rem] grid-cols-2 sm:max-w-xs"
                }`}
              >
                {massProductionSamples.map((sample) => (
                  <figure key={sample.id}>
                    {/* アップロード画像は公開Storage URLなので next/image のhost設定に依存させない */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sample.image ?? ""}
                      alt={`量産イラスト作例「${sample.name}」`}
                      loading="lazy"
                      className="aspect-square w-full rounded-xl border object-cover"
                      style={{ borderColor: c.borderSubtle }}
                    />
                    <figcaption
                      className="mt-1 text-center text-sm font-bold"
                      style={{ color: c.textSoft }}
                    >
                      {sample.name}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
          </div>

          <a
            href={`${contactPath}?mode=quote&plan=${NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE}${structuredIntake ? "&structured=1" : ""}`}
            onClick={() => trackPlan("量産イラスト")}
            className="pf-btn pf-btn-sm pf-cute-focus mt-3 block shrink-0 px-5 py-2.5 text-center text-sm font-bold sm:mt-0"
            style={{ borderColor: c.actionDisplay, color: c.text, background: c.surface }}
          >
            このプランで相談
          </a>
        </div>
      ) : (
        <div
          className="pf-sketch-soft mx-auto mt-6 flex max-w-3xl flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-2.5 sm:px-5"
        >
          <h3 className="font-bold">量産イラスト</h3>
          <p className="flex items-baseline gap-2 text-sm" style={{ color: c.textSoft }}>
            <span className="font-bold">{startingPriceLabel(massProductionPrice)}</span>
            <span className="rounded-full px-2.5 py-0.5 font-bold" style={{ background: c.surfaceSubtle }}>現在受付停止中</span>
          </p>
        </div>
      )}

      {/* 追加オプション。一覧は畳み、見出しに代表的な名前だけ出す */}
      {content.options.length > 0 ? (
        <details
          className="group pf-sketch-soft mx-auto mt-8 max-w-3xl sm:mt-12"
        >
          <summary className="pf-cute-focus flex min-h-[48px] cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-3 sm:px-6 md:px-8 md:py-4 [&::-webkit-details-marker]:hidden">
            <div className="min-w-0 flex-1">
              <h3 className="inline text-lg font-black md:text-xl">追加オプション</h3>
              <span className="ml-2 text-sm" style={{ color: c.textSoft }}>{optionsHint(content.options)}</span>
            </div>
            <ChevronDown
              aria-hidden="true"
              className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
              style={{ color: c.textSoft }}
            />
          </summary>
          <ul className="divide-y px-4 pb-3 sm:px-6 md:px-8" style={{ borderColor: c.borderSubtle }}>
            {content.options.map((option, index) => (
              <li
                key={option.id ?? `legacy-option-${index}`}
                className="flex items-baseline justify-between gap-4 py-2 text-sm md:py-2.5 md:text-base"
                style={{ borderColor: c.borderSubtle }}
              >
                <span style={{ color: c.textSoft }}>{option.name}</span>
                <span className="shrink-0 font-bold" style={{ color: c.text }}>
                  {option.price}
                </span>
              </li>
            ))}
          </ul>
          {/* 料金の補足はオプションの中にさらに畳む。補足（将来の返金表など）が増えたらここに並べる */}
          {content.options.some((option) => option.id === PORTFOLIO_OPTION_IDS.sampleUsageDenied || option.id === PORTFOLIO_OPTION_IDS.privateWork) ? (
            <details className="group/note mx-4 mb-4 rounded-xl sm:mx-6 md:mx-8 md:mb-5" style={{ background: c.surfaceSubtle }}>
              <summary className="pf-cute-focus flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">非公開オプションの違い</span>
                <ChevronDown
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 transition-transform group-open/note:rotate-180 motion-reduce:transition-none"
                  style={{ color: c.textSoft }}
                />
              </summary>
              <div className="px-3 pb-3 text-sm leading-relaxed" style={{ color: c.textSoft }}>
                <p><b>サンプル使用不可：</b>完成イラストをポートフォリオ・SNS・サンプル画像等へ掲載しません。</p>
                <p className="mt-2"><b>完全非公開：</b>制作内容・完成イラストを含め一切公開せず、ご依頼内容も非公開で対応します。</p>
              </div>
            </details>
          ) : null}
        </details>
      ) : null}

      {/* 特定商取引法に基づく表記の「販売価格」と同じ内容。免税事業者のため消費税を上乗せしない */}
      <p className="mx-auto mt-4 max-w-3xl text-center text-sm leading-6 sm:text-sm" style={{ color: c.textSoft }}>
        ※当方は消費税の免税事業者のため、表示価格に消費税はかかりません。
      </p>
    </section>
  );
}

/** 畳んだ追加オプションの見出し横に出す件数。名前は長いものがあるので出さない。 */
function optionsHint(options: PortfolioContent["options"]): string {
  return `全${options.length}件`;
}
