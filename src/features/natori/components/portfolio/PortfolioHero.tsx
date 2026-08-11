// features/natori/components/portfolio/PortfolioHero.tsx
// メインビジュアル(丸画像)は当面非表示。content.heroImage 自体は残してあるので、
// 復活させる場合は git 履歴のビジュアル列を戻す。
import {
  portfolioColors as c,
  portfolioDecorativeColors as d,
} from "@/features/natori/constants/portfolioContent";
import type { PortfolioContent, PortfolioVariant } from "@/features/natori/types/portfolio";
import Sparkle from "./Sparkle";
import { fontEnStyle } from "./portfolioFonts";

export default function PortfolioHero({
  content,
  variant = "full",
}: {
  content: PortfolioContent;
  variant?: PortfolioVariant;
}) {
  return (
    <section className="relative mx-auto max-w-6xl overflow-hidden px-5 pb-20 pt-16">
      {/* 星は上部の余白帯（pt-16 の範囲内）に置き、テキストと重ねない */}
      <Sparkle style={{ top: 10, left: "40%" }} color={d.sparkleWarm} size={20} />
      <Sparkle style={{ top: 30, right: "10%" }} color={d.sparkleCool} size={16} />
      <div>
        <p
          className="mb-3 text-sm font-semibold uppercase tracking-widest"
          style={{ ...fontEnStyle, color: c.accent }}
        >
          {content.roleEn}
        </p>
        <h1 className="mb-4 text-4xl font-black leading-tight md:text-5xl">
          <span style={{ color: c.accent }}>{content.heroTitleAccent}</span>
          {content.heroTitleTail}
        </h1>
        <p className="mb-8 max-w-md text-base leading-relaxed" style={{ color: c.textSoft }}>
          {content.heroDescription}
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="#gallery"
            className="pf-cute-focus rounded-full px-6 py-3 font-bold text-white shadow-md hover:brightness-105"
            style={{ background: c.accent, color: c.onAccent }}
          >
            作品を見る
          </a>
          {variant === "showcase" ? null : (
            <a
              href="#form"
              className="pf-cute-focus rounded-full border-2 px-6 py-3 font-bold hover:bg-white"
              style={{ borderColor: c.accent, color: c.accent }}
            >
              依頼してみる
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
