"use client";

// ============================================
// SectionBackground - 世界観に応じた背景レイヤー
// ============================================
// About/Works/Services/Skills/Contact で共通の背景演出

import React, { useMemo } from "react";
import type { Design } from "@/lib/aura/aura.schema";
import type { VariantSpec } from "@/lib/aura/aura.variant.base";
import { buildSectionBackgroundStyle } from "@/lib/aura/aura.background";
import {
  buildDecorationLayers,
  getWorldviewOverride,
} from "@/lib/aura/aura.designSystem";

type Props = {
  theme: Design["theme"];
  variant: VariantSpec;
  sectionType: string;
  isDark: boolean;
  accentColor: string;
  overallStrength: number;
};

export const SectionBackground: React.FC<Props> = ({
  theme,
  variant,
  sectionType,
  isDark,
  accentColor,
  overallStrength,
}) => {
  const worldview = String((variant as any)?.worldview ?? "business");
  const override = getWorldviewOverride(worldview);
  const isMinimalLike = worldview === "minimal" || worldview === "business";

  // 背景スタイル
  const bgStyle = useMemo(
    () => buildSectionBackgroundStyle(theme, variant, sectionType),
    [theme, variant, sectionType]
  );

  // 装飾レイヤー
  const decorations = useMemo(
    () => buildDecorationLayers(worldview, overallStrength, accentColor, isDark),
    [worldview, overallStrength, accentColor, isDark]
  );

  // 可読性オーバーレイの透明度
  const bgOverlayOpacity = useMemo(() => {
    if (overallStrength <= 20) return isDark ? 0.55 : 0.72;
    if (overallStrength <= 60) return isDark ? 0.5 : 0.68;
    return isDark ? 0.46 : 0.64;
  }, [overallStrength, isDark]);

  // アクセントグロー表示条件
  const ACCENT_AT = 40;
  const PLUS_AT = 70;

  const useAccentBg = overallStrength >= ACCENT_AT;
  const usePlus = overallStrength >= PLUS_AT && !isMinimalLike;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0"
      style={bgStyle}
    >
      {/* 1) 可読性オーバーレイ */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark ? "rgba(2,6,23,0.72)" : "rgba(255,255,255,0.78)",
          opacity: bgOverlayOpacity,
        }}
      />

      {/* 2) スキャンライン（cyber） */}
      {decorations.scanlinesBg && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: decorations.scanlinesBg,
            opacity: 0.5,
          }}
        />
      )}

      {/* 3) ノイズテクスチャ */}
      {decorations.showNoise && (
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
          }}
        />
      )}

      {/* 4) アクセントグロー（40〜） */}
      {useAccentBg && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 80% 50% at 20% 10%, ${accentColor} 0%, transparent 50%)`,
            opacity: isDark ? 0.16 : 0.12,
          }}
        />
      )}

      {/* 5) プラスα（70〜） */}
      {usePlus && (
        <>
          {/* セカンドグロー */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 60% 40% at 90% 90%, ${accentColor} 0%, transparent 55%)`,
              opacity: isDark ? 0.12 : 0.08,
            }}
          />
          {/* エッジハイライト */}
          <div
            className="absolute inset-0"
            style={{
              background: isDark
                ? "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 25%)"
                : "linear-gradient(180deg, rgba(15,23,42,0.04) 0%, transparent 20%)",
            }}
          />
        </>
      )}
    </div>
  );
};
