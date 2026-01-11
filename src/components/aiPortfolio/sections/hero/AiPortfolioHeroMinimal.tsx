"use client";

// ============================================
// AiPortfolioHeroMinimal（スクショ型 1スクリーンHERO版）
// - Nav / 強い見出し / 2CTA / Scroll cue を内包
// - applyVariantStyle の radius/shadow/surface を尊重
// - 世界観差は「背景・装飾・ボタンのトーン」で出す（レイアウトは壊さない）
// - ✅ overallStrength により「カード表示の有無」を制御（0-24: no-card / 25-69: card / 70-100: card+rich）
// ============================================

import React, { CSSProperties, useMemo } from "react";
import { applyVariantStyle } from "../../applyVariantStyle";
import type { HeroProps } from "./HeroTypes";

// ---------------------------------------------------------
// fontPreset → className
// ---------------------------------------------------------
const FONT_CLASS_BY_PRESET: Record<string, string> = {
  cleanJa: "ai-portfolio-font-cleanJa",
  modernSans: "ai-portfolio-font-modernSans",
  formalMincho: "ai-portfolio-font-formalMincho",
  cuteRound: "ai-portfolio-font-cuteRound",
  popBold: "ai-portfolio-font-popBold",
  techMono: "ai-portfolio-font-techMono",
  luxurySerif: "ai-portfolio-font-luxurySerif",
  retroPixel: "ai-portfolio-font-retroPixel",

  cuteJa: "ai-portfolio-font-cuteJa",
  formalJa: "ai-portfolio-font-formalJa",
  globalBold: "ai-portfolio-font-globalBold",
  serifJa: "ai-portfolio-font-serifJa",
  retroPop: "ai-portfolio-font-retroPop",
};

// ---------------------------------------------------------
// worldview -> Label 専用フォント
// ---------------------------------------------------------
const LABEL_FONT_BY_WORLDVIEW: Record<string, string> = {
  minimal: "ai-portfolio-font-cleanJa",
  modern: "ai-portfolio-font-modernSans",
  business: "ai-portfolio-font-modernSans",
  cute: "ai-portfolio-font-cuteJa",
  pop: "ai-portfolio-font-popBold",
  dark: "ai-portfolio-font-techMono",
  cyber: "ai-portfolio-font-techMono",
  natural: "ai-portfolio-font-serifJa",
  luxury: "ai-portfolio-font-luxurySerif",
  retro: "ai-portfolio-font-retroPixel",
};

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------
function safeStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function clamp01to100(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function getLanguageMode(section: any, theme: any): "ja" | "en" | "jaEn" {
  const m = safeStr(section?.languageMode) || safeStr(theme?.languageMode);
  if (m === "en" || m === "jaEn") return m;
  return "ja";
}

function t(lang: "ja" | "en" | "jaEn", key: string) {
  const dict = {
    eyebrow: { ja: "ILLUSTRATOR", en: "ILLUSTRATOR", jaEn: "ILLUSTRATOR" },
    ctaWorks: { ja: "作品を見る", en: "View Works", jaEn: "WORKSを見る" },
    ctaContact: { ja: "お問い合わせ", en: "Contact", jaEn: "CONTACT" },
    more: { ja: "もっと見る", en: "Scroll", jaEn: "もっと見る" },
    brand: { ja: "Portfolio", en: "Portfolio", jaEn: "Portfolio" },
    about: { ja: "About", en: "About", jaEn: "About" },
    works: { ja: "Works", en: "Works", jaEn: "Works" },
    services: { ja: "Services", en: "Services", jaEn: "Services" },
    skills: { ja: "Skills", en: "Skills", jaEn: "Skills" },
    contact: { ja: "Contact", en: "Contact", jaEn: "Contact" },
  } as const;

  const row = (dict as any)[key];
  if (!row) return key;
  return row[lang] ?? row.ja;
}

function isSafeHref(href: string) {
  // 同一ページ内のアンカーのみ許可（余計な外部遷移を避ける）
  return href.startsWith("#");
}

function scrollToHash(hash: string) {
  if (!hash || !hash.startsWith("#")) return;
  const el = document.querySelector(hash);
  if (el && "scrollIntoView" in el) {
    (el as any).scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  // fallback
  location.hash = hash;
}

// ---------------------------------------------------------
// Component
// ---------------------------------------------------------
export const AiPortfolioHeroMinimal: React.FC<HeroProps> = ({
  section,
  theme,
  variant,
  layoutType,
  heroLayout,
}) => {
  const v = applyVariantStyle(variant, theme);

  // ✅ overallStrength（Renderer注入）を取得
  const strength = clamp01to100(Number((variant as any)?.overallStrength ?? 0));

  // ✅ カード表示段階
  // 0: no-card / 1: card / 2: card+rich
  const cardMode = strength >= 70 ? 2 : strength >= 25 ? 1 : 0;
  const showCard = cardMode >= 1;

  // Layout 判定（将来拡張用。今は見た目は固定し、崩れにくい方針）
  const layoutHint =
    heroLayout ||
    layoutType ||
    (variant.layout === "split" ? "splitHero" : "centerBasic");

  const lang = getLanguageMode(section as any, theme as any);

  // Content
  const headings = section.headings ?? [];
  const paragraphs = section.paragraphs ?? [];

  // 仕様：
  // headings[0]=大見出し1, headings[1]=大見出し2（任意）
  // paragraphs[0]=サブコピー
  const h1 = safeStr(headings[0]);
  const h2 = safeStr(headings[1]);
  const tagline = safeStr(paragraphs[0]);

  // 背景：theme.bgGradient / colorBG をベースに、世界観で装飾を少し足す
  const bgBase =
    safeStr((theme as any).bgGradient) ||
    safeStr((theme as any).colorBG) ||
    "linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(240,249,255,1) 100%)";

  const accent = v.accentColor || (theme as any).colorAccent || theme.colorPrimary;

  const fontClass = useMemo(() => {
    let cls = "ai-portfolio-font-cleanJa";
    const preset = safeStr((theme as any).fontPreset);
    if (!preset) return cls;

    if (preset.startsWith("ai-portfolio-font-")) return preset;
    return FONT_CLASS_BY_PRESET[preset] || cls;
  }, [theme]);

  const labelFontClass = LABEL_FONT_BY_WORLDVIEW[variant.worldview] ?? fontClass;

  // Hero全体：1スクリーンで余裕を作る
  const heroOuterStyle: CSSProperties = {
    background: bgBase,
    color: v.textColor,
  };

  // 中央の“Heroカード”は surfaceRegistry 統一値を使う
  // ※ cardMode=2 は少しだけ強める（レイアウトは同じ）
  const heroCardStyle: CSSProperties = {
    borderRadius: v.radius,
    background: v.surfaceBG,
    border: `1px solid ${v.borderColor}`,
    boxShadow:
      cardMode === 2
        ? `${v.shadow}, 0 0 0 1px rgba(255,255,255,0.18), 0 28px 70px rgba(15,23,42,0.10)`
        : v.shadow,
  };

  const isDark = v.isDark;

  const headlineClass =
    "font-extrabold tracking-tight leading-[1.05] text-[clamp(2.2rem,5.4vw,3.8rem)]";

  const sublineClass = "mt-5 text-[clamp(0.95rem,1.4vw,1.1rem)] leading-relaxed";

  const primaryBtnClass =
    "inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition-transform duration-200 hover:-translate-y-[1px] active:translate-y-0";

  const secondaryBtnClass =
    "inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-85";

  // CTAリンク（将来 section.cta を見てもいいが、まずは固定で良い）
  const worksHref = "#works";
  const contactHref = "#contact";

  // ✅ カード無し時は「直置き」前提で余白を増やす（スクショのように“余裕”を作る）
  const innerPaddingClass = showCard
    ? "mx-auto max-w-5xl overflow-hidden px-6 py-10 md:px-10 md:py-14"
    : "mx-auto max-w-5xl px-2 py-2 md:px-2 md:py-2";

  // ✅ カード無し時はテキストブロックに独立の余白を付与（背景直置きで成立させる）
  const noCardTextWrapClass = "px-4 py-10 md:px-6 md:py-14";

  return (
    <section
      aria-label="Hero"
      className={`relative w-full ${fontClass}`}
      style={heroOuterStyle}
      data-hero-card-mode={cardMode}
      data-hero-strength={strength}
    >
      {/* 背景装飾（世界観差分は“薄く”） */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* 上部の薄い光 */}
        <div
          className="absolute -top-24 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full blur-3xl"
          style={{
            opacity: showCard ? 0.25 : 0.18,
            background: `radial-gradient(circle, ${accent} 0%, transparent 60%)`,
          }}
        />
        {/* 角の薄いグラデ（dark/cyberは控えめ） */}
        <div
          className="absolute -bottom-28 -right-28 h-[420px] w-[420px] rounded-full blur-3xl"
          style={{
            opacity: isDark ? (showCard ? 0.1 : 0.07) : showCard ? 0.18 : 0.12,
            background: `radial-gradient(circle, ${accent} 0%, transparent 62%)`,
          }}
        />

        {/* ✅ cardMode=2（強度高）だけ、薄いライン/ノイズを足す（やりすぎない） */}
        {cardMode === 2 ? (
          <>
            <div
              className="absolute inset-0 opacity-[0.035]"
              style={{
                backgroundImage:
                  'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
              }}
            />
            <div
              className="absolute inset-x-0 top-0 h-px"
              style={{
                background: `linear-gradient(90deg, transparent 0%, ${accent} 50%, transparent 100%)`,
                opacity: 0.35,
              }}
            />
          </>
        ) : null}
      </div>

      {/* 中央：Heroコンテンツ（ほぼ1スクリーン） */}
      <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-6xl items-center px-4 pb-16 pt-10 md:px-6 md:pb-20 md:pt-12">
        <div className="w-full">
          {/* ✅ カード有無をここで分岐 */}
          {showCard ? (
            <div className={innerPaddingClass} style={heroCardStyle}>
              {/* Eyebrow */}
              <div className="mb-5 flex items-center justify-center md:justify-start">
                <span
                  className={`text-[11px] font-semibold uppercase tracking-[0.28em] ${labelFontClass}`}
                  style={{ color: v.mutedText }}
                >
                  {t(lang, "eyebrow")}
                </span>
              </div>

              <div className={layoutHint === "splitHero" ? "md:max-w-3xl" : ""}>
                <h1 className={headlineClass} style={{ color: v.textColor }}>
                  {h1 || "クリエイティブな"}
                  {h2 ? (
                    <>
                      <br />
                      {h2}
                    </>
                  ) : null}
                </h1>

                {tagline ? (
                  <p className={sublineClass} style={{ color: v.mutedText }}>
                    {tagline}
                  </p>
                ) : null}

                {/* CTA（✅常に中央寄せ） */}
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <button
                    type="button"
                    className={primaryBtnClass}
                    style={{
                      background: accent,
                      color: isDark ? "rgba(2,6,23,0.96)" : "#ffffff",
                      boxShadow: isDark
                        ? `0 18px 42px rgba(0,0,0,0.40)`
                        : `0 18px 42px rgba(15,23,42,0.12)`,
                    }}
                    onClick={() => isSafeHref(worksHref) && scrollToHash(worksHref)}
                  >
                    {t(lang, "ctaWorks")}
                  </button>

                  <button
                    type="button"
                    className={secondaryBtnClass}
                    style={{
                      background: "transparent",
                      color: v.textColor,
                      border: `1px solid ${v.borderColor}`,
                      boxShadow: "none",
                    }}
                    onClick={() => isSafeHref(contactHref) && scrollToHash(contactHref)}
                  >
                    {t(lang, "ctaContact")}
                  </button>
                </div>

                {/* Scroll cue（✅常に中央寄せ） */}
                <div className="mt-10 flex items-center justify-center">
                  <button
                    type="button"
                    className="group inline-flex items-center gap-2 text-xs"
                    style={{ color: v.mutedText }}
                    onClick={() => scrollToHash("#about")}
                  >
                    <span>{t(lang, "more")}</span>
                    <span className="transition-transform duration-200 group-hover:translate-y-[1px]">
                      ↓
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // ✅ no-card
            <div className={innerPaddingClass}>
              <div className={noCardTextWrapClass}>
                {/* Eyebrow */}
                <div className="mb-5 flex items-center justify-center md:justify-start">
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-[0.28em] ${labelFontClass}`}
                    style={{ color: v.mutedText }}
                  >
                    {t(lang, "eyebrow")}
                  </span>
                </div>

                <div className={layoutHint === "splitHero" ? "md:max-w-3xl" : ""}>
                  <h1 className={headlineClass} style={{ color: v.textColor }}>
                    {h1 || "クリエイティブな"}
                    {h2 ? (
                      <>
                        <br />
                        {h2}
                      </>
                    ) : null}
                  </h1>

                  {tagline ? (
                    <p className={sublineClass} style={{ color: v.mutedText }}>
                      {tagline}
                    </p>
                  ) : null}

                  {/* CTA（✅常に中央寄せ） */}
                  <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <button
                      type="button"
                      className={primaryBtnClass}
                      style={{
                        background: accent,
                        color: isDark ? "rgba(2,6,23,0.96)" : "#ffffff",
                        boxShadow: isDark
                          ? `0 18px 42px rgba(0,0,0,0.40)`
                          : `0 18px 42px rgba(15,23,42,0.12)`,
                      }}
                      onClick={() => isSafeHref(worksHref) && scrollToHash(worksHref)}
                    >
                      {t(lang, "ctaWorks")}
                    </button>

                    <button
                      type="button"
                      className={secondaryBtnClass}
                      style={{
                        background: "transparent",
                        color: v.textColor,
                        border: `1px solid ${v.borderColor}`,
                        boxShadow: "none",
                      }}
                      onClick={() => isSafeHref(contactHref) && scrollToHash(contactHref)}
                    >
                      {t(lang, "ctaContact")}
                    </button>
                  </div>

                  {/* Scroll cue（✅常に中央寄せ） */}
                  <div className="mt-10 flex items-center justify-center">
                    <button
                      type="button"
                      className="group inline-flex items-center gap-2 text-xs"
                      style={{ color: v.mutedText }}
                      onClick={() => scrollToHash("#about")}
                    >
                      <span>{t(lang, "more")}</span>
                      <span className="transition-transform duration-200 group-hover:translate-y-[1px]">
                        ↓
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
