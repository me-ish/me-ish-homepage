// features/natori/components/portfolio/PortfolioHero.tsx
import Image from "next/image";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import type { PortfolioContent, PortfolioVariant } from "@/features/natori/types/portfolio";
import { fontEnStyle } from "./portfolioFonts";

export default function PortfolioHero({
  content,
  variant = "full",
}: {
  content: PortfolioContent;
  variant?: PortfolioVariant;
}) {
  const fallbackWork = content.works.find((work) => Boolean(work.image));
  const representativeImage = content.heroImage || fallbackWork?.image || null;
  const hasExplicitHeroImage = Boolean(content.heroImage);
  const representativeAlt = hasExplicitHeroImage
    ? `${content.artistName}の代表作品`
    : fallbackWork?.title ?? "";

  return (
    <section
      id="hero"
      className="mx-auto max-w-6xl scroll-mt-28 px-5 pb-16 pt-12 md:pb-20 md:pt-16"
    >
      <div
        className={`grid items-center gap-10 md:gap-14 ${
          representativeImage
            ? "md:grid-cols-[minmax(0,0.9fr)_minmax(20rem,1.1fr)]"
            : "max-w-2xl"
        }`}
      >
        <div className="max-w-xl">
          <p className="mb-2 text-sm font-bold tracking-wide" style={{ color: c.textSoft }}>
            {content.artistName}
          </p>
          <p
            className="mb-4 text-sm font-semibold uppercase tracking-[0.18em]"
            style={{ ...fontEnStyle, color: c.accentText }}
          >
            {content.roleEn}
          </p>
          <h1 className="mb-5 text-4xl font-black leading-[1.18] tracking-tight md:text-5xl lg:text-6xl">
            <span style={{ color: c.accentDisplay }}>{content.heroTitleAccent}</span>
            {content.heroTitleTail}
          </h1>
          <p
            className="mb-8 max-w-lg text-base leading-relaxed md:text-lg"
            style={{ color: c.textSoft }}
          >
            {content.heroDescription}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {variant === "showcase" ? null : (
              <a
                href="#form"
                className="pf-cute-focus inline-flex min-h-12 items-center justify-center rounded-xl px-6 py-3 font-bold"
                style={{ background: c.accent, color: c.onAccent }}
              >
                相談・見積もり
              </a>
            )}
            <a
              href="#gallery"
              className="pf-cute-focus inline-flex min-h-12 items-center justify-center rounded-xl border-2 px-6 py-3 font-bold"
              style={{ background: c.surface, borderColor: c.accent, color: c.accentText }}
            >
              作品を見る
            </a>
          </div>
        </div>

        {representativeImage ? (
          <figure className="w-full min-w-0 max-w-lg justify-self-center md:justify-self-end">
            <div
              className="relative aspect-square overflow-hidden rounded-2xl border"
              style={{ background: c.surfaceSubtle, borderColor: c.borderSubtle }}
            >
              <Image
                src={representativeImage}
                alt={representativeAlt}
                fill
                sizes="(min-width: 1024px) 512px, (min-width: 768px) 46vw, calc(100vw - 40px)"
                className="object-contain"
              />
            </div>
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
