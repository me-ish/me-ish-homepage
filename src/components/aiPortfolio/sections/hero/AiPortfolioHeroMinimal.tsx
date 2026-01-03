// ============================================
// AiPortfolioHeroMinimal（文字色最適化＋layout対応版＋ラベルフォント世界観対応）
// - dark判定を applyVariantStyle(v.isDark) に統一（商品版）
// ============================================

import React, { CSSProperties } from "react";
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
// Initial
// ---------------------------------------------------------
function getInitialsFromName(name: string | undefined): string {
  if (!name) return "PF";
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (/^[a-zA-Z]+$/.test(trimmed)) return trimmed.slice(0, 2).toUpperCase();
  return trimmed.slice(0, 2);
}

export const AiPortfolioHeroMinimal: React.FC<HeroProps> = ({
  section,
  theme,
  variant,
  layoutType,
  heroLayout,
}) => {
  const v = applyVariantStyle(variant, theme);

  // -----------------------------
  // Layout 判定
  // -----------------------------
  const layoutHint =
    heroLayout ||
    layoutType ||
    (variant.layout === "split" ? "splitHero" : "centerBasic");

  const isSplit = layoutHint === "splitHero" || layoutHint === "galleryFocus";

  // -----------------------------
  // Content
  // -----------------------------
  const headings = section.headings ?? [];
  const paragraphs = section.paragraphs ?? [];

  const title = headings[0] ?? "";
  const subtitle = headings[1] ?? "";
  const tagline = paragraphs[0] ?? "";

  const iconUrl = (section as any).iconUrl || (section as any).avatarUrl;
  const initials = getInitialsFromName(title);

  // -----------------------------
  // 背景
  // -----------------------------
  const heroBackground =
    (theme as any).bgGradient ||
    `linear-gradient(145deg, rgba(255,255,255,0.98) 0%, ${theme.colorBG} 100%)`;

  const heroStyle: CSSProperties = {
    borderRadius: "24px",
    boxShadow:
      v.shadow ||
      "0 20px 40px -12px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.04)",
    border: "1px solid rgba(255,255,255,0.7)",
    background: heroBackground,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  };

  // -----------------------------
  // テキスト色 最適化（dark判定を共通化）
  // -----------------------------
  const DARK = v.isDark;

  const titleColor = DARK ? "#F9FAFB" : "#111827";

  const labelColor = DARK
    ? "rgba(209,213,219,0.90)"
    : "rgba(107,114,128,0.80)";

  const subtitleColor = DARK
    ? "rgba(226,232,240,0.92)"
    : "rgba(75,85,99,0.92)";

  const taglineColor = DARK
    ? "rgba(229,231,235,0.90)"
    : "rgba(55,65,81,0.90)";

  const accentColor = theme.colorAccent || theme.colorPrimary;

  // -----------------------------
  // フォント（全体）
  // -----------------------------
  let fontClass = "ai-portfolio-font-cleanJa";

  if ((theme as any).fontPreset) {
    const preset = String((theme as any).fontPreset);
    if (preset.startsWith("ai-portfolio-font-")) {
      fontClass = preset;
    } else {
      fontClass = FONT_CLASS_BY_PRESET[preset] || "ai-portfolio-font-cleanJa";
    }
  }

  // -----------------------------
  // Label 専用フォント
  // -----------------------------
  const labelFontClass = LABEL_FONT_BY_WORLDVIEW[variant.worldview] ?? fontClass;

  // -----------------------------
  // JSX
  // -----------------------------
  return (
    <section className={`w-full px-2 py-4 md:px-4 md:py-6 ${fontClass}`}>
      <div className="relative mx-auto max-w-4xl">
        <div
          className="relative overflow-hidden transition-all duration-300 hover:shadow-xl"
          style={heroStyle}
        >
          {/* 上ハイライト */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/70 to-transparent opacity-80" />

          {/* ノイズ */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
            }}
          />

          {/* 内容 */}
          <div
            className={`relative z-10 px-6 py-8 md:px-10 md:py-12 ${
              isSplit
                ? "flex flex-col md:flex-row md:items-start md:gap-8"
                : "flex flex-col items-center text-center md:flex-row md:items-center md:gap-8 md:text-left"
            }`}
          >
            {/* icon */}
            <div className="mb-6 flex-shrink-0 md:mb-0">
              <div className="relative group">
                <div
                  className="absolute -inset-2 rounded-full opacity-20 blur-xl transition-opacity group-hover:opacity-40"
                  style={{
                    background: `linear-gradient(135deg, ${theme.colorPrimary} 0%, ${
                      theme.colorAccent || theme.colorPrimary
                    } 100%)`,
                  }}
                />
                <div
                  className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 shadow-sm transition-transform duration-300 group-hover:scale-105 md:h-24 md:w-24"
                  style={{
                    borderColor: "rgba(255,255,255,0.96)",
                    background: iconUrl ? "#f3f4f6" : theme.colorPrimary,
                    color: iconUrl ? undefined : "#ffffff",
                  }}
                >
                  {iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={iconUrl}
                      alt={title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="select-none text-xl font-bold tracking-wider md:text-2xl">
                      {initials}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Text */}
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              {/* Profile ラベル（世界観フォント） */}
              <div className="mb-1 flex items-center justify-center gap-2 md:justify-start">
                <span
                  className="hidden h-px w-6 md:block"
                  style={{ backgroundColor: accentColor, opacity: 0.6 }}
                />
                <p
                  className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${labelFontClass}`}
                  style={{ color: labelColor }}
                >
                  PROFILE
                </p>
              </div>

              <h1
                className="text-3xl font-bold tracking-tight leading-[1.1] md:text-4xl lg:text-5xl"
                style={{ color: titleColor }}
              >
                {title || "Your Name"}
              </h1>

              {subtitle && (
                <p
                  className="mt-1 text-sm font-medium md:text-base"
                  style={{ color: subtitleColor }}
                >
                  {subtitle}
                </p>
              )}

              {tagline && (
                <p
                  className="mt-4 max-w-2xl text-sm leading-relaxed md:text-base md:leading-relaxed"
                  style={{ color: taglineColor }}
                >
                  {tagline}
                </p>
              )}
            </div>
          </div>

          {/* Bottom line */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1 opacity-85"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${
                theme.colorAccent || theme.colorPrimary
              } 55%, transparent 100%)`,
              maskImage:
                "linear-gradient(to right, transparent, black 20%, black 80%, transparent)",
            }}
          />
        </div>
      </div>
    </section>
  );
};
