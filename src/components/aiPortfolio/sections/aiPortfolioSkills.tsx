// src/components/aiPortfolio/sections/aiPortfolioSkills.tsx
// （セクション見出し：WORKS / SERVICES / CONTACT と統一：中央厳密）

"use client";

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

export const AiPortfolioSkills: React.FC<Props> = ({ section, theme, variant }) => {
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

  const isDarkWorld = v.isDark;
  const accent = v.accentColor || theme.colorAccent || theme.colorPrimary;

  const surfaceBG = isDarkWorld
    ? v.surfaceBG
    : "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,255,255,0.94))";

  const tagBG = isDarkWorld ? "rgba(15,23,42,0.9)" : "rgba(255,255,255,0.98)";
  const tagTextColor = isDarkWorld ? "#E5E7EB" : "#111827";

  // タグ列の寄せ（layoutに追従）
  const tagsJustify = variant.layout === "split" ? "justify-start" : "justify-center";

  return (
    <section className="px-3 pb-6 md:px-4 md:pb-8" aria-label="Skills">
      {/* ======= 見出し（中央厳密） ======= */}
      <div className="mb-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          <div aria-hidden />
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2">
              <span
                className="hidden h-px w-6 md:block"
                style={{ backgroundColor: accent }}
              />
              <div
                className="inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.30em] md:text-xs"
                style={{
                  backgroundColor: isDarkWorld
                    ? "rgba(15,23,42,0.75)"
                    : "rgba(255,255,255,0.9)",
                  color: isDarkWorld
                    ? "rgba(249,250,251,0.96)"
                    : "rgba(15,23,42,0.9)",
                  borderColor: isDarkWorld
                    ? "rgba(148,163,184,0.7)"
                    : "rgba(148,163,184,0.5)",
                }}
              >
                {heading}
              </div>
            </div>
          </div>
          <div aria-hidden />
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
        <div className={`flex flex-wrap gap-2 ${tagsJustify}`}>
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
