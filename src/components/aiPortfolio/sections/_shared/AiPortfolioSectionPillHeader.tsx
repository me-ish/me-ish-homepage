"use client";

import React from "react";
import type { Design } from "@/lib/aiPortfolio/aiPortfolio.schema";
import type { VariantSpec } from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import { applyVariantStyle } from "../../applyVariantStyle";

type Props = {
  label: string;
  theme: Design["theme"];
  variant: VariantSpec;

  /** 右側に出したいもの（itemsバッジ等）。無ければ空で中央厳密。 */
  rightSlot?: React.ReactNode;

  /** 左側に出したいもの（基本は未使用）。 */
  leftSlot?: React.ReactNode;

  /** 下に余白を付けたい時など */
  className?: string;
};

export const AiPortfolioSectionPillHeader: React.FC<Props> = ({
  label,
  theme,
  variant,
  rightSlot,
  leftSlot,
  className,
}) => {
  const v = applyVariantStyle(variant, theme);
  const isDarkWorld = v.isDark;

  const accent = v.accentColor || theme.colorAccent || theme.colorPrimary;

  return (
    <div className={className ?? "mb-3"}>
      {/* 中央厳密：左右の影響を受けない */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center">
        <div className="flex justify-start">{leftSlot ?? <span aria-hidden />}</div>

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
              {label}
            </div>
          </div>
        </div>

        <div className="flex justify-end">{rightSlot ?? <span aria-hidden />}</div>
      </div>
    </div>
  );
};
