// features/natori/components/portfolio/PortfolioHero.tsx
// 1画面目。作品を縦長の額で大きく見せ、呼び名・紹介文・料金などの目安・相談ボタンを添える。
// スマホは「作品 → 呼び名 → 目安と相談ボタン → 紹介文」の順にして、相談ボタンを1画面目に入れる。
import { natoriSoftActionClassName } from "@/features/natori/constants/natoriPrimaryAction";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import { portfolioHeroFacts } from "@/features/natori/lib/portfolioHeroFacts";
import type { PortfolioContent, PortfolioVariant } from "@/features/natori/types/portfolio";
import { fontEnStyle } from "./portfolioFonts";
import PortfolioHeroPrimaryCta from "./PortfolioHeroPrimaryCta";
import PortfolioHeroSlider from "./PortfolioHeroSlider";

export default function PortfolioHero({
  content,
  variant = "full",
  contactPath,
}: {
  content: PortfolioContent;
  variant?: PortfolioVariant;
  contactPath?: string;
}) {
  const fallbackWork = content.works.find((work) => work.published && Boolean(work.image));
  const configuredHeroImages = (
    content.heroImages?.length
      ? content.heroImages
      : content.heroImage
        ? [content.heroImage]
        : []
  ).filter((image): image is string => Boolean(image));
  const hasExplicitHeroImage = configuredHeroImages.length > 0;
  const heroImages = hasExplicitHeroImage
    ? configuredHeroImages
    : fallbackWork?.image
      ? [fallbackWork.image]
      : [];
  const slides = heroImages.map((src, index) => ({
    src,
    alt: hasExplicitHeroImage
      ? index === 0
        ? `${content.artistName}の代表作品`
        : `${content.artistName}の代表作品 ${index + 1}`
      : fallbackWork?.title ?? "",
  }));
  const hasArt = slides.length > 0;
  const showcase = variant === "showcase";
  // 料金・お返事・納期は依頼の判断材料。showcase（営業先向け）と受付停止中は出さない。
  const facts = !showcase && content.commissionOpen ? portfolioHeroFacts(content) : [];

  return (
    <section
      id="hero"
      className="mx-auto max-w-6xl scroll-mt-28 pb-10 pt-4 md:px-5 md:pb-20 md:pt-14"
    >
      <div
        className={`grid items-center gap-4 md:gap-12 lg:gap-16 ${
          hasArt ? "md:grid-cols-[minmax(0,1fr)_auto]" : "mx-auto max-w-2xl"
        }`}
      >
        <div
          className={`contents md:block md:min-w-0 ${
            hasArt ? "md:max-w-xl" : "md:col-span-2 md:text-center"
          }`}
        >
          <div className="order-2 min-w-0 px-5 md:order-none md:px-0">
            <p
              className="mb-3 hidden text-[13px] font-semibold uppercase tracking-[0.2em] md:block"
              style={{ ...fontEnStyle, color: c.actionTextSmall }}
            >
              {content.roleEn}
            </p>
            <h1
              aria-label={`${content.heroTitleAccent}${content.heroTitleTail}`}
              className="text-[32px] font-black leading-[1.18] tracking-tight md:mb-5 md:text-5xl lg:text-6xl"
            >
              <span aria-hidden="true" style={{ color: c.text }}>
                {content.heroTitleAccent}
              </span>
              <span
                aria-hidden="true"
                className="break-words sm:whitespace-nowrap"
                style={{ color: c.actionText }}
              >
                {content.heroTitleTail}
              </span>
            </h1>
          </div>

          <div className="order-4 min-w-0 px-5 md:order-none md:px-0">
            <p
              className={`max-w-lg text-[15px] leading-relaxed md:mb-6 md:text-lg ${hasArt ? "" : "md:mx-auto"}`}
              style={{ color: c.textSoft }}
            >
              {content.heroDescription}
            </p>
          </div>

          <div className="order-3 min-w-0 px-5 md:order-none md:px-0">
            {facts.length > 0 ? (
              <dl
                className={`mb-4 grid max-w-[26rem] overflow-hidden rounded-2xl border md:mb-6 ${hasArt ? "" : "md:mx-auto"}`}
                style={{
                  gridTemplateColumns: `repeat(${facts.length}, minmax(0, 1fr))`,
                  background: c.surface,
                  borderColor: c.borderSubtle,
                }}
              >
                {facts.map((fact, index) => (
                  <div
                    key={fact.label}
                    className={`min-w-0 px-3 py-1.5 md:py-2.5 lg:px-4 ${index > 0 ? "border-l" : ""} ${hasArt ? "" : "md:text-center"}`}
                    style={{ borderColor: c.borderSubtle }}
                  >
                    <dt className="truncate text-[13px] font-bold leading-snug" style={{ color: c.actionTextSmall }}>
                      {fact.label}
                    </dt>
                    <dd className="text-[15px] font-black leading-snug md:text-base" style={{ color: c.text }}>
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <div className={`flex flex-wrap gap-3 ${hasArt ? "" : "md:justify-center"}`}>
              {showcase ? null : (
                <PortfolioHeroPrimaryCta
                  href={contactPath}
                  className={`${natoriSoftActionClassName} pf-cute-focus inline-flex min-h-12 flex-1 items-center justify-center rounded-full border-2 px-6 py-3 text-base font-black sm:flex-none`}
                  style={{}}
                />
              )}
              <a
                href="#gallery"
                className="pf-cute-focus inline-flex min-h-12 items-center justify-center rounded-full border-2 px-5 py-3 font-bold sm:px-6"
                style={{ background: c.surface, borderColor: c.action, color: c.text }}
              >
                作品を見る
              </a>
            </div>
          </div>
        </div>

        {hasArt ? (
          <figure className="order-1 w-full min-w-0 px-5 pt-2 md:order-none md:w-auto md:px-0 md:pt-0">
            <PortfolioHeroSlider slides={slides} />
            {!hasExplicitHeroImage && fallbackWork ? (
              <figcaption
                className="mt-3 flex items-baseline justify-center gap-2 text-sm"
                style={{ color: c.textSoft }}
              >
                <span className="text-[13px] font-semibold uppercase tracking-[0.16em]">
                  Selected work
                </span>
                <span className="font-bold" style={{ color: c.text }}>
                  {fallbackWork.title}
                </span>
              </figcaption>
            ) : null}
          </figure>
        ) : null}
      </div>
    </section>
  );
}
