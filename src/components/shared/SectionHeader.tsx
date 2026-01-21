// src/components/shared/SectionHeader.tsx
'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface SectionHeaderProps {
  /** セクションの主タイトル（必須） */
  title: string;
  /** サブタイトル（任意） */
  subtitle?: string;
  /** 配置: center（デフォルト）または left */
  align?: 'center' | 'left';
  /** アクセントカラーを適用するか（デフォルト: true） */
  accent?: boolean;
  /** HTML id属性（アンカーリンク用） */
  id?: string;
  /** タイトルに適用する追加クラス */
  titleClassName?: string;
  /** サブタイトルに適用する追加クラス */
  subtitleClassName?: string;
  /** コンテナに適用する追加クラス */
  className?: string;
  /** タイトルの後に配置する子要素（アクションボタン等） */
  children?: React.ReactNode;
}

/**
 * SectionHeader
 * ────────────────────────────────────────────────────────────────
 * me-ishブランドに最適化された統一セクション見出しコンポーネント。
 * Tailwindで統一された余白・階層・色を提供。
 */
export function SectionHeader({
  title,
  subtitle,
  align = 'center',
  accent = true,
  id,
  titleClassName,
  subtitleClassName,
  className,
  children,
}: SectionHeaderProps) {
  const alignClasses = align === 'center' ? 'text-center' : 'text-left';

  return (
    <header
      className={cn(
        'mb-8 md:mb-10',
        alignClasses,
        className
      )}
    >
      {/* タイトル行: 見出し + 子要素（アクションボタン等） */}
      <div
        className={cn(
          'flex items-center gap-4',
          align === 'center' ? 'justify-center' : 'justify-between'
        )}
      >
        <h2
          id={id}
          className={cn(
            'font-bold leading-tight tracking-tight',
            'text-[clamp(1.5rem,3.2vw,2.2rem)]',
            accent ? 'text-[#00a1e9]' : 'text-[#023]',
            titleClassName
          )}
        >
          {title}
        </h2>
        {children}
      </div>

      {/* サブタイトル */}
      {subtitle && (
        <p
          className={cn(
            'mt-2 text-[clamp(0.9rem,1.4vw,1rem)] leading-relaxed',
            'text-[#556] max-w-2xl',
            align === 'center' && 'mx-auto',
            subtitleClassName
          )}
        >
          {subtitle}
        </p>
      )}
    </header>
  );
}

export default SectionHeader;
