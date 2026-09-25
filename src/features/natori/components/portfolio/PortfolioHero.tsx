// features/natori/components/portfolio/PortfolioHero.tsx
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
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

  return (
    <section
      id="hero"
      className="mx-auto max-w-6xl scroll-mt-28 px-5 pb-8 pt-12 md:pb-20 md:pt-16"
    >
      <div
        className={`grid items-center gap-6 md:gap-14 ${
          slides.length > 0
            ? "md:grid-cols-[minmax(0,0.9fr)_minmax(20rem,1.1fr)]"
            : "max-w-2xl"
        }`}
      >
        <div className="contents md:block md:min-w-0 md:max-w-xl">
          <div className="order-1 min-w-0 md:order-none">
            <p
              className="mb-4 text-sm font-semibold uppercase tracking-[0.18em]"
              style={{ ...fontEnStyle, color: c.accentText }}
            >
              {content.roleEn}
            </p>
            <h1
              aria-label={`${content.heroTitleAccent}${content.heroTitleTail}`}
              className="text-4xl font-black leading-[1.18] tracking-tight md:mb-5 md:text-5xl lg:text-6xl"
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

          <div className="order-3 min-w-0 md:order-none">
            <p
              className="mb-5 max-w-lg text-base leading-relaxed md:text-lg"
              style={{ color: c.textSoft }}
            >
              {content.heroDescription}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {variant === "showcase" ? null : (
                <PortfolioHeroPrimaryCta
                  href={contactPath}
                  className="pf-cute-focus inline-flex min-h-12 items-center justify-center rounded-xl border-2 px-6 py-3 text-base font-black hover:brightness-95"
                  style={{
                    background: c.action,
                    borderColor: c.actionDisplay,
                    color: c.onAction,
                  }}
                />
              )}
              <a
                href="#gallery"
                className="pf-cute-focus inline-flex min-h-12 items-center justify-center rounded-xl border-2 px-6 py-3 font-bold"
                style={{ background: c.surface, borderColor: c.actionDisplay, color: c.text }}
              >
                作品を見る
              </a>
            </div>
          </div>
        </div>

        {slides.length > 0 ? (
          <figure className="order-2 w-full min-w-0 max-w-lg justify-self-center md:order-none md:justify-self-end">
            <PortfolioHeroSlider slides={slides} />
            {!hasExplicitHeroImage && fallbackWork ? (
              <figcaption
                className="mt-3 flex items-baseline gap-2 text-sm"
                style={{ color: c.textSoft }}
              >
                <span className="text-xs font-semibold uppercase tracking-[0.16em]">
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
