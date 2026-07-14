// features/natori/components/portfolio/PortfolioHero.tsx
// メインビジュアル(丸画像)は当面非表示。content.heroImage 自体は残してあるので、
// 復活させる場合は git 履歴のビジュアル列を戻す。
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import type { PortfolioContent } from "@/features/natori/types/portfolio";
import Sparkle from "./Sparkle";
import { fontEnStyle } from "./portfolioFonts";

export default function PortfolioHero({ content }: { content: PortfolioContent }) {
  return (
    <section className="relative mx-auto max-w-6xl overflow-hidden px-5 pb-20 pt-16">
      <Sparkle style={{ top: 10, left: "40%" }} color={c.yellow} size={20} />
      {/* ピンクの見出し文字と被らないよう、色はミント・位置は左端寄りにする */}
      <Sparkle style={{ top: 64, left: "2%" }} color={c.mint} size={16} />
      <div>
        <p
          className="mb-3 text-sm font-semibold uppercase tracking-widest"
          style={{ ...fontEnStyle, color: c.pinkDeep }}
        >
          {content.roleEn}
        </p>
        <h1 className="mb-4 text-4xl font-black leading-tight md:text-5xl">
          <span style={{ color: c.pink }}>{content.heroTitleAccent}</span>
          {content.heroTitleTail}
        </h1>
        <p className="mb-8 max-w-md text-base leading-relaxed" style={{ color: c.inkSoft }}>
          {content.heroDescription}
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="#gallery"
            className="pf-cute-focus rounded-full px-6 py-3 font-bold text-white shadow-md hover:brightness-105"
            style={{ background: c.pink }}
          >
            作品を見る
          </a>
          <a
            href="#form"
            className="pf-cute-focus rounded-full border-2 px-6 py-3 font-bold hover:bg-white"
            style={{ borderColor: c.pink, color: c.pinkDeep }}
          >
            依頼してみる
          </a>
        </div>
      </div>
    </section>
  );
}
