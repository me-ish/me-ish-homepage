"use client";

import React from "react";
import type { Design, Content } from "@/lib/aiPortfolio/aiPortfolio.schema";
import type { VariantSpec } from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import { applyVariantStyle } from "../applyVariantStyle";
import { AiPortfolioSectionPillHeader } from "./_shared/AiPortfolioSectionPillHeader";

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

  const isDarkWorld = v.isDark;

  const surfaceBG = isDarkWorld
    ? v.surfaceBG
    : "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,255,255,0.94))";

  const textColor = isDarkWorld ? v.textColor ?? "#E5E7EB" : "#111827";
  const bodyColor = isDarkWorld
    ? "rgba(226,232,240,0.92)"
    : "rgba(55,65,81,0.9)";

  return (
    <section className="px-3 pb-6 md:px-4 md:pb-8" aria-label="About">
      {/* 中央基準を統一 */}
      <div className="mx-auto w-full max-w-5xl">
        <AiPortfolioSectionPillHeader
          label={heading}
          theme={theme}
          variant={variant}
          className="mb-3"
        />

        <div
          className="border px-6 py-6 md:px-8 md:py-8"
          style={{
            borderColor: v.borderColor,
            borderRadius: v.radius,
            boxShadow: v.shadow,
            background: surfaceBG,
            color: textColor,
          }}
        >
          <div
            className={`mt-2 space-y-3 text-sm leading-relaxed ${
              variant.layout === "split" ? "text-left" : "text-center"
            }`}
            style={{ color: bodyColor }}
          >
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
