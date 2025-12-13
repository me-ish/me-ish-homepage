// src/components/aiPortfolio/sections/aiPortfolioSkills.tsx
// （セクション見出し：WORKS / SERVICES / CONTACT / CTA と統一）

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
      return "スキル";
    case "jaEn":
      return "SKILLS / スキル";
    case "en":
    default:
      return "SKILLS";
  }
}

export const AiPortfolioSkills: React.FC<Props> = ({
  section,
  theme,
  variant,
}) => {
  const v = applyVariantStyle(variant, theme);

  const rawSection = section as any;
  const headings: string[] | undefined = rawSection.headings;
  const items: any[] = rawSection.items ?? [];

  const heading = headings?.[0] ?? getDefaultHeading(theme.languageMode);

  // ===== タグ抽出 =====
  const tags: string[] = [];
  items.forEach((item) => {
    if (!item) return;
    if (typeof item === "string") tags.push(item);
    else if (item.label) tags.push(item.label);
    else if (item.title) tags.push(item.title);
  });

  if (tags.length === 0) return null;

  const alignClass =
    variant.layout === "split" ? "text-left" : "text-center";

  const isDarkWorld =
    variant.worldview === "dark" ||
    variant.worldview === "cyber" ||
    variant.worldview === "luxury";

  const headingColor = isDarkWorld
    ? "rgba(249,250,251,0.96)"
    : "rgba(31,41,55,0.9)";

  const accent =
    v.accentColor || theme.colorAccent || theme.colorPrimary;

  const surfaceBG = isDarkWorld
    ? v.surfaceBG
    : "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,255,255,0.94))";

  const tagBG = isDarkWorld
    ? "rgba(15,23,42,0.9)"
    : "rgba(255,255,255,0.98)";
  const tagTextColor = isDarkWorld ? "#E5E7EB" : "#111827";

  return (
    <section
      className={`px-3 pb-6 md:px-4 md:pb-8 ${alignClass}`}
      aria-label="Skills"
    >
      {/* ======= セクション見出し（pill型で全セクション共通） ======= */}
      <div className="mb-3 flex items-center justify-between">
        <div
          className={`flex flex-1 ${
            variant.layout === "split" ? "justify-start" : "justify-center"
          }`}
        >
          <div className="inline-flex items-center gap-2">
            {/* 左の細線 */}
            <span
              className="hidden h-px w-6 md:block"
              style={{
                backgroundColor: accent,
                opacity: 0.7,
              }}
            />
            {/* pill（丸カプセル） */}
            <div
              className="inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.30em] md:text-xs"
              style={{
                backgroundColor: isDarkWorld
                  ? "rgba(15,23,42,0.75)"
                  : "rgba(255,255,255,0.9)",
                color: headingColor,
                borderColor: isDarkWorld
                  ? "rgba(148,163,184,0.7)"
                  : "rgba(148,163,184,0.5)",
              }}
            >
              {heading.toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* ======= カード（土台） ======= */}
      <div
        className="border px-4 py-3 md:px-5 md:py-4"
        style={{
          borderRadius: v.radius,
          borderColor: v.borderColor,
          boxShadow: v.shadow,
          background: surfaceBG,
        }}
      >
        <div
          className={`flex flex-wrap gap-2 ${
            variant.layout === "split" ? "justify-start" : "justify-center"
          }`}
        >
          {tags.map((tag, i) => (
            <span
              key={i}
              className="px-3 py-1 text-xs font-medium"
              style={{
                borderRadius: "999px",
                background: tagBG,
                color: tagTextColor,
                border: `1px solid ${accent}26`,
                boxShadow:
                  "0 1px 2px rgba(15,23,42,0.12), 0 0 0 1px rgba(255,255,255,0.8)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};
