'use client';

import React, { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BackToTopProps {
  /** スクロール位置がこの値を超えたら表示（デフォルト: 400px） */
  threshold?: number;
  /** 追加のクラス名 */
  className?: string;
}

/**
 * BackToTop
 * ────────────────────────────────────────────────────────────────
 * 画面右下に固定表示されるトップへ戻るボタン。
 * スクロール位置に応じて表示/非表示をアニメーション付きで切り替え。
 */
export function BackToTop({ threshold = 400, className }: BackToTopProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > threshold);
    };

    // 初期チェック
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <button
      onClick={scrollToTop}
      aria-label="ページトップへ戻る"
      className={cn(
        'fixed bottom-6 right-6 z-50',
        'flex h-12 w-12 items-center justify-center',
        'rounded-full bg-[#00a1e9] text-white shadow-lg',
        'transition-all duration-300 ease-out',
        'hover:bg-[#008ed0] hover:shadow-xl hover:scale-110',
        'focus:outline-none focus:ring-2 focus:ring-[#00a1e9] focus:ring-offset-2',
        visible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-4 opacity-0 pointer-events-none',
        className
      )}
    >
      <ChevronUp className="h-6 w-6" />
    </button>
  );
}

export default BackToTop;
