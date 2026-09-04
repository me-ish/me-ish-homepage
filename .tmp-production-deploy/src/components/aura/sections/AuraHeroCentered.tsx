// src/components/aura/sections/AuraHeroCentered.tsx
// layout = "center" / "split" の両方に対応したリッチ版

import React from "react";
import type { Design, Content } from "@/lib/aura/aura.schema";
import type { VariantSpec } from "@/lib/aura/aura.variant.base";
import { applyVariantStyle } from "../applyVariantStyle";

type Props = {
  section: Content["sections"][number];
  theme: Design["theme"];
  variant: VariantSpec;
};

export const AuraHeroCentered: React.FC<Props> = ({
  section,
  theme,
  variant,
}) => {
  const v = applyVariantStyle(variant, theme);
  const [line1, line2] = section.headings ?? [];
  const tagline = section.paragraphs?.[0];

  const isSplit = variant.layout === "split";

  return (
    <section className="px-3 pt-3 pb-6 md:px-4 md:pb-8" aria-label="Hero">
      <div
        className="relative border px-5 py-6 md:px-9 md:py-8"
        style={{
          borderRadius: v.radius,
          boxShadow: v.shadow,
          background: v.surfaceBG,
          borderColor: v.borderColor,
        }}
      >
        {/* 上部の小さなラベル */}
        <div className="mb-4 text-[10px] uppercase tracking-[0.35em]">
          <span style={{ color: v.mutedText }}>PORTFOLIO</span>
        </div>

        <div
          className={
            isSplit
              ? "grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center"
              : "space-y-4 text-center"
          }
        >
          {/* 左側（または中央）の名前・肩書き */}
          <div className={isSplit ? "text-left space-y-3" : "space-y-3"}>
            {line1 && (
              <h1
                className="text-3xl md:text-4xl font-semibold tracking-tight"
                style={{ color: v.textColor }}
              >
                {line1}
              </h1>
            )}
            {line2 && (
              <p
                className="text-xs md:text-sm font-medium uppercase tracking-[0.25em]"
                style={{ color: v.mutedText }}
              >
                {line2}
              </p>
            )}
            {tagline && !isSplit && (
              <p
                className="mx-auto max-w-2xl text-xs md:text-sm leading-relaxed"
                style={{ color: v.mutedText }}
              >
                {tagline}
              </p>
            )}
          </div>

          {/* 右側（split のときだけ詳細テキスト） */}
          {isSplit && (
            <div className="space-y-2 text-sm leading-relaxed">
              {tagline && (
                <p style={{ color: v.mutedText }}>
                  {tagline}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
