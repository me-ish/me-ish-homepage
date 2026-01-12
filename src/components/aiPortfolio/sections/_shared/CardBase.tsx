"use client";

// ============================================
// CardBase - 共通カードコンポーネント
// ============================================
// 全セクションで統一されたカードスタイルを提供

import React from "react";
import type { VariantStyle } from "../../applyVariantStyle";
import { SPACING, TRANSITION } from "@/lib/aiPortfolio/aiPortfolio.designSystem";

type Props = {
  children: React.ReactNode;
  /** applyVariantStyle の結果 */
  v: VariantStyle;
  /** コンパクト余白 */
  compact?: boolean;
  /** ホバーリフト効果 */
  hoverLift?: boolean;
  /** glass効果（backdrop-blur） */
  glass?: boolean;
  /** 追加クラス */
  className?: string;
  /** 追加スタイル（override用） */
  style?: React.CSSProperties;
  /** クリックハンドラ */
  onClick?: () => void;
  /** ボタンとしてレンダリング */
  asButton?: boolean;
  /** aria-label（ボタン時） */
  ariaLabel?: string;
};

export const CardBase: React.FC<Props> = ({
  children,
  v,
  compact = false,
  hoverLift = true,
  glass = false,
  className = "",
  style,
  onClick,
  asButton = false,
  ariaLabel,
}) => {
  const padding = compact ? SPACING.card.paddingCompact : SPACING.card.padding;
  const hoverClass = hoverLift ? TRANSITION.hoverLiftSm : "";
  const glassClass = glass ? "backdrop-blur-md" : "";

  const baseStyle: React.CSSProperties = {
    borderColor: v.borderColor,
    borderRadius: v.radius,
    boxShadow: v.shadow,
    background: v.surfaceBG,
    color: v.textColor,
    ...style,
  };

  const baseClass = `border ${padding} ${TRANSITION.base} ${hoverClass} ${glassClass} ${className}`;

  if (asButton || onClick) {
    return (
      <button
        type="button"
        className={baseClass}
        style={baseStyle}
        onClick={onClick}
        aria-label={ariaLabel}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={baseClass} style={baseStyle}>
      {children}
    </div>
  );
};
