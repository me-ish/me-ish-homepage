"use client";

// ============================================
// AiPortfolioSectionPillHeader - セクション見出し（改良版）
// ============================================
// - 世界観ごとの装飾バリエーション追加
// - Typography トークン適用
// - 左右の装飾ラインを強化

import React from "react";
import type { Design } from "@/lib/aiPortfolio/aiPortfolio.schema";
import type { VariantSpec } from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import { applyVariantStyle } from "../../applyVariantStyle";
import {
  TYPOGRAPHY,
  getWorldviewOverride,
} from "@/lib/aiPortfolio/aiPortfolio.designSystem";

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
  const isDark = v.isDark;
  const worldview = String((variant as any)?.worldview ?? "business");
  const override = getWorldviewOverride(worldview);

  const accent = v.accentColor || theme.colorAccent || theme.colorPrimary;

  // 世界観ごとの装飾バリエーション
  const isNeon = override.decorations.neonBorder;
  const isGold = override.decorations.goldAccent;
  const isRounded = override.decorations.roundedEmphasis;

  // ピルのボーダー色
  const pillBorderColor = isNeon
    ? accent
    : isGold
      ? "#D4AF37"
      : isDark
        ? "rgba(148,163,184,0.6)"
        : "rgba(148,163,184,0.45)";

  // ピルの背景
  const pillBg = isDark
    ? "rgba(15,23,42,0.8)"
    : "rgba(255,255,255,0.92)";

  // ピルのシャドウ（世界観で差を出す）
  const pillShadow = isNeon
    ? `0 0 12px ${accent}40, 0 0 24px ${accent}20`
    : isGold
      ? "0 2px 8px rgba(212,175,55,0.15)"
      : isDark
        ? "0 2px 8px rgba(0,0,0,0.2)"
        : "0 2px 8px rgba(15,23,42,0.06)";

  // 装飾ライン色
  const lineColor = isGold ? "#D4AF37" : accent;

  return (
    <div className={className ?? "mb-6"}>
      {/* 中央厳密：左右の影響を受けない */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        {/* 左スロット or 装飾ライン */}
        <div className="flex items-center justify-start">
          {leftSlot ?? (
            <div
              className="hidden h-px flex-1 md:block"
              style={{
                background: `linear-gradient(90deg, transparent 0%, ${lineColor} 100%)`,
                opacity: isDark ? 0.4 : 0.5,
              }}
              aria-hidden
            />
          )}
        </div>

        {/* 中央：ピル */}
        <div className="flex justify-center">
          <div
            className={`inline-flex items-center gap-2 border px-4 py-1.5 ${
              isRounded ? "rounded-full" : "rounded-lg"
            } ${TYPOGRAPHY.heading.section}`}
            style={{
              backgroundColor: pillBg,
              color: isDark ? "rgba(249,250,251,0.96)" : "rgba(15,23,42,0.88)",
              borderColor: pillBorderColor,
              boxShadow: pillShadow,
            }}
          >
            {/* 左アクセントドット */}
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: lineColor, opacity: 0.8 }}
              aria-hidden
            />
            <span>{label}</span>
          </div>
        </div>

        {/* 右スロット or 装飾ライン */}
        <div className="flex items-center justify-end">
          {rightSlot ?? (
            <div
              className="hidden h-px flex-1 md:block"
              style={{
                background: `linear-gradient(90deg, ${lineColor} 0%, transparent 100%)`,
                opacity: isDark ? 0.4 : 0.5,
              }}
              aria-hidden
            />
          )}
        </div>
      </div>
    </div>
  );
};
