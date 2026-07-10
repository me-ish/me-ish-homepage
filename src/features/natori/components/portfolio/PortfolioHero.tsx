// features/natori/components/portfolio/PortfolioHero.tsx
import Image from "next/image";
import {
  portfolioColors as c,
  portfolioImages,
  portfolioProfile,
} from "@/features/natori/constants/portfolioContent";
import ChibiFace from "./ChibiFace";
import Sparkle from "./Sparkle";
import { fontEnStyle } from "./portfolioFonts";

export default function PortfolioHero() {
  return (
    <section className="relative mx-auto grid max-w-6xl items-center gap-10 overflow-hidden px-5 pb-20 pt-16 md:grid-cols-2">
      <Sparkle style={{ top: 10, left: "40%" }} color={c.yellow} size={20} />
      <Sparkle style={{ top: 90, left: "10%" }} color={c.pink} size={16} />
      <div>
        <p
          className="mb-3 text-sm font-semibold uppercase tracking-widest"
          style={{ ...fontEnStyle, color: c.pinkDeep }}
        >
          {portfolioProfile.roleEn}
        </p>
        <h1 className="mb-4 text-4xl font-black leading-tight md:text-5xl">
          <span style={{ color: c.pink }}>{portfolioProfile.heroTitleAccent}</span>
          {portfolioProfile.heroTitleTail}
        </h1>
        <p className="mb-8 max-w-md text-base leading-relaxed" style={{ color: c.inkSoft }}>
          {portfolioProfile.heroDescription}
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="#gallery"
            className="pf-cute-focus rounded-full px-6 py-3 font-bold text-white shadow-md hover:brightness-105"
            style={{ ...fontEnStyle, background: c.pink }}
          >
            作品を見る
          </a>
          <a
            href="#form"
            className="pf-cute-focus rounded-full border-2 px-6 py-3 font-bold hover:bg-white"
            style={{ ...fontEnStyle, borderColor: c.pink, color: c.pinkDeep }}
          >
            依頼してみる
          </a>
        </div>
      </div>

      <div className="relative flex justify-center">
        {/* メインビジュアル。portfolioImages.hero を設定すると実画像に差し替わる */}
        <div
          className="pf-floaty relative flex items-center justify-center overflow-hidden rounded-full"
          style={{
            width: 260,
            height: 260,
            background: c.card,
            boxShadow: "0 20px 40px rgba(45,42,61,0.12)",
          }}
        >
          {portfolioImages.hero ? (
            <Image
              src={portfolioImages.hero}
              alt={`${portfolioProfile.artistName} メインビジュアル`}
              fill
              sizes="260px"
              className="object-cover"
            />
          ) : (
            <ChibiFace size={170} skin="#FFE3D1" hair="#F3A6C1" accent={c.pink} />
          )}
        </div>
        <span
          className="pf-wobble absolute -right-2 -top-2 rounded-full px-3 py-2 text-xs font-bold shadow"
          style={{ ...fontEnStyle, background: c.yellow, color: c.ink }}
        >
          NEW ✦
        </span>
      </div>
    </section>
  );
}
