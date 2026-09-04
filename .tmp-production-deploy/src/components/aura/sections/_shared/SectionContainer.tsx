"use client";

// ============================================
// SectionContainer - セクション共通のコンテナ
// ============================================
// 全セクションで統一された余白・幅・スクロールマージンを提供

import React from "react";
import { SPACING } from "@/lib/aura/aura.designSystem";

type Props = {
  children: React.ReactNode;
  /** セクションID（ナビリンク用） */
  id?: string;
  /** aria-label */
  ariaLabel?: string;
  /** コンパクト余白（Hero等で使用） */
  compact?: boolean;
  /** 最大幅の種類 */
  maxWidth?: "prose" | "section" | "hero" | "full";
  /** 追加クラス */
  className?: string;
  /** 追加スタイル */
  style?: React.CSSProperties;
};

export const SectionContainer: React.FC<Props> = ({
  children,
  id,
  ariaLabel,
  compact = false,
  maxWidth = "section",
  className = "",
  style,
}) => {
  const py = compact
    ? SPACING.section.paddingYCompact
    : SPACING.section.paddingY;
  const px = SPACING.section.paddingX;
  const mw = SPACING.maxWidth[maxWidth];

  return (
    <section
      id={id}
      aria-label={ariaLabel}
      className={`relative overflow-hidden ${py} ${px} ${SPACING.scrollMargin} ${className}`}
      style={style}
    >
      <div className={`relative z-10 mx-auto w-full ${mw}`}>{children}</div>
    </section>
  );
};
