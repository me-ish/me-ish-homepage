'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { FileText } from 'lucide-react';

type Variant = 'floating' | 'inline';

interface Props {
  variant?: Variant;
  href?: string;
  label?: string;
  showOnPaths?: string[];
}

export default function SalesGuidelineLink({
  variant = 'floating',
  href = '/guides/sales',
  label = '販売ガイドライン',
  showOnPaths = ['/entry'],
}: Props) {
  const pathname = usePathname();
  const [pulse, setPulse] = useState(false);

  // 初回〜数回だけ軽いパルスを出す（視認性UP）。動きが苦手な人には出さない。
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const KEY = 'meish_guideline_hint_count';
    const count = Number(localStorage.getItem(KEY) || '0');
    if (count < 2) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 6000); // 6秒だけ
      localStorage.setItem(KEY, String(count + 1));
      return () => clearTimeout(t);
    }
  }, []);

    // 画面幅（スマホだけ位置を逃がす）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 640px)'); // Tailwindのsm未満
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

   const [isNarrow, setIsNarrow] = useState(false);

  const shouldShow = !!pathname && showOnPaths.some((p) => pathname.startsWith(p));
  if (!shouldShow) return null;

  if (variant === 'inline') {
    return (
      <p className="mt-2 text-sm text-gray-700">
        応募前に
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          prefetch={false}
          className="ml-1 underline text-[#00a1e9] hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00a1e9]/60 rounded-sm"
        >
          {label}
        </Link>
        をご確認ください。
      </p>
    );
  }

  // ====== Floating（右下ピル型）======
  return (
    <div
      className="fixed z-[60]"
      style={
        isNarrow
          ? {
              left: 'max(1rem, env(safe-area-inset-left))',
              right: 'auto',
              // 「次へ」固定ボタンの高さぶん上に逃がす（約72px）
              bottom: 'calc(max(1rem, env(safe-area-inset-bottom)) + 72px)',
            }
          : {
              left: 'auto',
              right: 'max(1rem, env(safe-area-inset-right))',
              bottom: 'max(1rem, env(safe-area-inset-bottom))',
            }
      }
    >
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        prefetch={false}
        aria-label={label}
        className={[
          // レイヤー: ガラス風 + 境界線 + 影
          'group flex items-center gap-2 rounded-full border bg-white/85 backdrop-blur-md',
          'border-[#00a1e9]/40 shadow-[0_6px_24px_-8px_rgba(0,0,0,.35)]',
          // サイズ/文字
          'px-4 py-2 text-[13px] sm:text-sm font-zen',
          // ホバー/フォーカス
          'hover:bg-white focus:outline-none focus-visible:ring-4 focus-visible:ring-[#00a1e9]/25',
          // 動き
          'transition-all',
          pulse ? 'ring-4 ring-[#00a1e9]/25' : '',
        ].join(' ')}
      >
        {/* アクセントの点（視認性UP） */}
        <span
          className={[
            'inline-block w-2 h-2 rounded-full',
            'bg-[#00a1e9] shadow-[0_0_8px_rgba(0,161,233,.8)]',
            pulse ? 'animate-ping-slow' : '',
          ].join(' ')}
          aria-hidden
        />
        <FileText className="w-4 h-4 opacity-80" />
        <span className="font-medium tracking-wide">販売ガイドライン</span>
        <span className="sr-only">{label}</span>
      </Link>

      <style jsx global>{`
        @keyframes ping-slow {
          0% {
            transform: scale(1);
            opacity: 0.9;
          }
          70% {
            transform: scale(2.2);
            opacity: 0;
          }
          100% {
            transform: scale(2.2);
            opacity: 0;
          }
        }
        .animate-ping-slow {
          animation: ping-slow 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
      `}</style>
    </div>
  );
}
