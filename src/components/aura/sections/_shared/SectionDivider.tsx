"use client";

// ============================================
// SectionDivider - 統一された区切り線
// ============================================

import React from "react";

type Props = {
  /** ボーダー色 */
  color: string;
  /** ダークテーマか */
  isDark?: boolean;
  /** 上余白 */
  className?: string;
};

export const SectionDivider: React.FC<Props> = ({
  color,
  isDark = false,
  className = "mt-8",
}) => {
  return (
    <div
      className={`h-px w-full ${className}`}
      style={{
        background: `linear-gradient(90deg, transparent 0%, ${color} 20%, ${color} 80%, transparent 100%)`,
        opacity: isDark ? 0.4 : 0.6,
      }}
      aria-hidden
    />
  );
};
