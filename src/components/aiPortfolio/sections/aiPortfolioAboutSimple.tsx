// src/components/aiPortfolio/sections/aiPortfolioAboutSimple.tsx
import React from "react";
import type { Design, Content } from "@/lib/aiPortfolio/aiPortfolio.schema";
import type { VariantSpec } from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import { applyVariantStyle } from "../applyVariantStyle";

type Props = {
  section: Content["sections"][number];
  theme: Design["theme"];
  variant: VariantSpec;
};

function getDefaultHeading(languageMode?: string) {
  switch (languageMode) {
    case "ja":
      return "自己紹介";
    case "jaEn":
      return "ABOUT / 自己紹介";
    case "en":
    default:
      return "ABOUT";
  }
}

export const AiPortfolioAboutSimple: React.FC<Props> = ({
  section,
  theme,
  variant,
}) => {
  const v = applyVariantStyle(variant, theme);
  const heading =
    section.headings?.[0] ?? getDefaultHeading(theme.languageMode);
  const paragraphs =
    section.paragraphs && section.paragraphs.length > 0
      ? section.paragraphs
      : ["自己紹介文がここに表示されます。"];

  const alignClass =
    variant.layout === "split" ? "text-left" : "text-center";

  const isDarkWorld =
    variant.worldview === "dark" ||
    variant.worldview === "cyber" ||
    variant.worldview === "luxury";

  // 背景パターンから独立した「紙カード」用スタイル
  const surfaceBG = isDarkWorld
    ? v.surfaceBG
    : "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,255,255,0.94))";

  const textColor = isDarkWorld
    ? v.textColor ?? "#E5E7EB"
    : "#111827";

  const bodyColor = isDarkWorld
    ? "rgba(226,232,240,0.92)"
    : "rgba(55,65,81,0.9)";

  // ===== セクション見出しの視認性向上ロジック =====
  const accent = theme.colorAccent || theme.colorPrimary;
  const darkBG =
    isDarkWorld ||
    ["#020617", "#0f172a", "#000000"].includes(
      String(theme.colorBG || "").toLowerCase(),
    );

  const headingTextColor = darkBG
    ? "rgba(249,250,251,0.96)" // slate-50
    : "rgba(15,23,42,0.9)"; // slate-900

  const headingChipBg = darkBG
    ? "rgba(15,23,42,0.7)" // slate-900/70
    : "rgba(255,255,255,0.85)";

  const headingBorderColor = darkBG
    ? "rgba(148,163,184,0.7)" // slate-400
    : "rgba(148,163,184,0.5)";

  const headingUnderlineColor = accent;

  const headingWrapperAlign =
    variant.layout === "split"
      ? "justify-start"
      : "justify-center";

  return (
    <section
      className={`px-3 pb-6 md:px-4 md:pb-8 ${alignClass}`}
      aria-label="About"
    >
      {/* セクションラベル */}
      <div
        className={`mb-3 flex ${headingWrapperAlign}`}
      >
        <div className="inline-flex items-center gap-2">
          {/* アクセントライン */}
          <span
            className="hidden h-px w-6 md:block"
            style={{ backgroundColor: headingUnderlineColor }}
          />

          {/* ラベルチップ */}
          <div
            className="inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.30em] md:text-xs"
            style={{
              color: headingTextColor,
              backgroundColor: headingChipBg,
              borderColor: headingBorderColor,
              textShadow: darkBG
                ? "0 1px 1px rgba(0,0,0,0.35)"
                : "none",
            }}
          >
            {heading}
          </div>
        </div>
      </div>

      {/* 本文カード */}
      <div
        className="border px-4 py-4 text-sm leading-relaxed md:px-6 md:py-6"
        style={{
          borderRadius: v.radius,
          borderColor: v.borderColor,
          boxShadow: v.shadow,
          background: surfaceBG,
          color: textColor,
        }}
      >
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className={i > 0 ? "mt-2" : undefined}
            style={{ color: bodyColor }}
          >
            {p}
          </p>
        ))}
      </div>
    </section>
  );
};
