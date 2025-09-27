'use client';

/* =============================================================================
   Natori Official Links — Ribbon + Angels / Vertical Links
   Big Card Container + Translucent Checkered Background + Slideshow
   Next.js(App Router) + Tailwind only (no external deps)
============================================================================= */

import React, { useEffect, useMemo, useRef, useState } from 'react';

/* ----------------------------- helpers ------------------------------------ */
function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}
function useStagger(baseDelay = 160) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const t = window.setTimeout(() => setReady(true), mq.matches ? 20 : 900);
    return () => clearTimeout(t);
  }, []);
  return (i: number) => (ready ? `${baseDelay * i}ms` : '0ms');
}

/* ----------------------------- tiny angel svg ----------------------------- */
function Angel({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 80 80"
      className={cn('h-10 w-10 md:h-12 md:w-12 opacity-90', flip && '-scale-x-100')}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <ellipse cx="40" cy="12" rx="16" ry="5" className="text-amber-400" fill="currentColor" opacity=".35" />
      <circle cx="40" cy="26" r="6" className="text-zinc-900 dark:text-zinc-100" fill="currentColor" />
      <path className="text-zinc-900 dark:text-zinc-100" fill="currentColor" d="M34 34h12c6 0 10 5 10 11v17H24V45c0-6 4-11 10-11z" />
      <path className="text-cyan-400" fill="currentColor" d="M28 38c-8 0-14 6-14 14 7-2 12-2 17 2 0-6-1-11-3-16z" opacity=".6" />
      <path className="text-cyan-400" fill="currentColor" d="M52 38c8 0 14 6 14 14-7-2-12-2-17 2 0-6 1-11 3-16z" opacity=".6" />
    </svg>
  );
}

/* ----------------------------- Pastel tile (fallback) --------------------- */
const PASTEL: [string, string, string][] = [
  ['#fff1f2', '#fde2e4', '#f8edeb'],
  ['#ecfeff', '#cffafe', '#bae6fd'],
  ['#fef9c3', '#fde68a', '#fef3c7'],
  ['#eef2ff', '#e9d5ff', '#f5f3ff'],
  ['#dcfce7', '#bbf7d0', '#f0fdf4'],
  ['#fae8ff', '#fde68a', '#e0e7ff'],
];
function PastelTile({
  label,
  index = 0,
  className,
}: { label: string; index?: number; className?: string }) {
  const [c1, c2, c3] = PASTEL[index % PASTEL.length];
  const bg = `radial-gradient(circle at 3px 3px, rgba(0,0,0,.06) 2px, transparent 2px) 0 0/10px 10px, linear-gradient(135deg, ${c1}, ${c2} 60%, ${c3})`;
  return (
    <div
      role="img"
      aria-label={label}
      className={cn('h-full w-full rounded-xl border border-white/60 dark:border-zinc-800', className)}
      style={{ background: bg }}
    />
  );
}

/* ----------------------------- Slideshow ---------------------------------- */
type Slide = { src?: string; alt: string };
function useAutoPlay(enabled: boolean, len: number, delay = 3500) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!enabled || len <= 1) return;
    const id = setInterval(() => setI((v) => (v + 1) % len), delay);
    return () => clearInterval(id);
  }, [enabled, len, delay]);
  return [i, setI] as const;
}

function SlideShow({
  images,
  heightClass = 'h-56 md:h-64',
}: {
  images: Slide[];
  heightClass?: string;
}) {
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [idx, setIdx] = useAutoPlay(!reduce, images.length, 3500);
  const safe = useMemo(
    () =>
      images.map((s, i) =>
        s?.src
          ? s
          : { alt: s.alt, src: undefined, _fallbackIndex: i } as any
      ),
    [images]
  );

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-white/60 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 backdrop-blur', heightClass)} aria-roledescription="carousel">
      {/* slides */}
      {safe.map((s: any, i) => {
        const active = i === idx;
        return (
          <div
            key={i}
            className={cn(
              'absolute inset-0 transition-opacity duration-700',
              active ? 'opacity-100' : 'opacity-0'
            )}
            role="group"
            aria-label={`${i + 1} / ${safe.length}`}
          >
            {s.src ? (
              // 実画像：/public/natori/works/... を想定
              <img src={s.src} alt={s.alt} className="h-full w-full object-cover" />
            ) : (
              // 画像未設定時のダミー（パステル板）
              <PastelTile label={s.alt} index={i} className="h-full w-full rounded-none" />
            )}
          </div>
        );
      })}

      {/* controls */}
      <button
        aria-label="前の作品"
        onClick={() => setIdx((p) => (p - 1 + safe.length) % safe.length)}
        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-white/60 bg-white/80 px-2 py-1 text-sm shadow hover:bg-white dark:border-zinc-700 dark:bg-zinc-800/80"
      >
        ‹
      </button>
      <button
        aria-label="次の作品"
        onClick={() => setIdx((p) => (p + 1) % safe.length)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/60 bg-white/80 px-2 py-1 text-sm shadow hover:bg-white dark:border-zinc-700 dark:bg-zinc-800/80"
      >
        ›
      </button>

      {/* dots */}
      <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-2">
        {safe.map((_, i) => (
          <button
            key={i}
            aria-label={`${i + 1}枚目へ`}
            onClick={() => setIdx(i)}
            className={cn(
              'h-2.5 w-2.5 rounded-full border border-white/70 dark:border-zinc-700',
              i === idx ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-white/60 dark:bg-zinc-800/70'
            )}
          />
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- Page --------------------------------------- */
export default function Page() {
  const welcomeRef = useRef<HTMLDivElement | null>(null);
  const [pinned, setPinned] = useState(false);
  const stagger = useStagger(160);

  // Welcome浮上→固定
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      setPinned(true);
      return;
    }
    const el = welcomeRef.current;
    if (!el) return;
    const onEnd = () => setPinned(true);
    el.addEventListener('animationend', onEnd, { once: true });
    return () => el.removeEventListener('animationend', onEnd);
  }, []);

  // === 差し替え推奨：実画像を /public/natori/works に置くだけでOK ===
  const slides: Slide[] = [
    { src: '/natori/works/w01-hero.webp', alt: '作品1のイメージ' },
    { src: '/natori/works/w02-hero.webp', alt: '作品2のイメージ' },
    { src: '/natori/works/w03-hero.webp', alt: '作品3のイメージ' },
  ];

  const links = [
    { label: 'X（Twitter）', sub: '@natori_handle', href: 'https://x.com/yourid' },
    { label: 'Instagram', sub: '@natori_illustration', href: 'https://www.instagram.com/yourid' },
    { label: 'TikTok', sub: '@natori_draw', href: 'https://www.tiktok.com/@yourid' },
    { label: 'BOOTH', sub: '同人誌・グッズ', href: 'https://yourid.booth.pm' },
    { label: 'Skeb', sub: 'コミッション受付', href: 'https://skeb.jp/@yourid' },
    { label: 'VGen', sub: 'Commission', href: 'https://vgen.co/yourid' },
  ] as const;

  return (
    <main
      className="relative min-h-svh overflow-x-hidden text-zinc-900 dark:text-zinc-50"
    >
      {/* ===== 透過チェック柄の背景（全画面） ===== */}
      <div
        aria-hidden
        className="fixed inset-0 -z-20"
        style={{
          // 透明度は alpha を下げてやさしく
          background:
            `repeating-linear-gradient(45deg, rgba(0,0,0,0.035) 0 14px, transparent 14px 28px),
             repeating-linear-gradient(-45deg, rgba(0,0,0,0.028) 0 14px, transparent 14px 28px)`,
        }}
      />

      {/* ===== 大きいカード（中にページ全体を収める） ===== */}
      <div className="relative z-0 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 md:py-10">
        <div className="rounded-[20px] border border-white/60 bg-white/80 shadow-xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/70">
          {/* 内側の余白 */}
          <div className="px-5 py-6 md:px-8 md:py-8">
            {/* WELCOMEリボン（天使つき） */}
            <div className="pt-[14svh] md:pt-[16svh]">
              <div
                ref={welcomeRef}
                className={cn(
                  'relative flex items-center justify-center',
                  pinned ? 'sticky top-3 z-40 animate-none' : 'animate-welcome-float'
                )}
                role="banner"
                aria-label="WELCOME"
              >
                {/* angels */}
                <div className="absolute -left-2 -translate-x-full">
                  <Angel />
                </div>
                <div className="absolute -right-2 translate-x-full">
                  <Angel flip />
                </div>

                {/* ribbon */}
                <div className="relative">
                  <div className="absolute -left-6 top-1/2 -translate-y-1/2 h-8 w-6">
                    <div className="ribbon-tail-left h-full w-full" />
                  </div>
                  <div className="absolute -right-6 top-1/2 -translate-y-1/2 h-8 w-6">
                    <div className="ribbon-tail-right h-full w-full" />
                  </div>
                  <div className="ribbon-body rounded-full border px-8 py-3 text-center shadow-lg backdrop-blur">
                    <span className="text-base font-black tracking-[0.18em]">WELCOME</span>
                  </div>
                </div>
              </div>
            </div>

            {/* タイトル */}
            <div className="mx-auto mt-6 text-center">
              <h1 className="text-xl font-extrabold tracking-wide md:text-2xl">
                ナトリ <span className="mx-1">OFFICIAL LINKS</span>
              </h1>
            </div>

            {/* 作品スライドショー（タイトル直下） */}
            <div className="mt-6">
              <SlideShow images={slides} heightClass="h-56 md:h-72" />
            </div>

            {/* 縦並びリンク */}
            <section id="links" className="mx-auto mt-8 max-w-xl">
              <p className="sr-only">下のリンクから、ナトリ先生の各公式アカウントやショップへ移動できます。</p>
              <ul className="space-y-3">
                {links.map((lk, i) => (
                  <li key={lk.label}>
                    <a
                      href={lk.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${lk.label} へ移動`}
                      className={cn(
                        'group relative block rounded-xl border border-white/60 bg-white/85 p-4 shadow-md backdrop-blur transition-colors dark:border-zinc-800 dark:bg-zinc-900/75',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                        'animate-card-in'
                      )}
                      style={{ animationDelay: stagger(i) } as React.CSSProperties}
                    >
                      <div
                        aria-hidden
                        className="pointer-events-none absolute -inset-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                        style={{
                          background:
                            'radial-gradient(40% 45% at 10% 0%, rgba(16,185,129,.16), transparent 60%), radial-gradient(40% 45% at 100% 10%, rgba(6,182,212,.16), transparent 60%)',
                        }}
                      />
                      <div className="relative z-10 flex items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-lg border border-white/60 bg-white/90 text-base shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                          ↗
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold">{lk.label}</div>
                          {lk.sub && <div className="truncate text-xs text-zinc-500">{lk.sub}</div>}
                        </div>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>

              <footer className="mt-10 text-center text-xs text-zinc-500">
                © {new Date().getFullYear()} Natori. All rights reserved.
              </footer>
            </section>
          </div>
        </div>
      </div>

      {/* ===== styles ===== */}
      <style jsx global>{`
        @keyframes welcome-float {
          0% { transform: translateY(40svh); opacity: 0; }
          60% { transform: translateY(6svh); opacity: 1; }
          100% { transform: translateY(0svh); opacity: 1; }
        }
        @keyframes card-in {
          0% { transform: translateY(12px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .animate-welcome-float { animation: welcome-float 900ms cubic-bezier(0.2, 0.7, 0.2, 1) both; }
        .animate-card-in { animation: card-in 520ms cubic-bezier(0.2, 0.7, 0.2, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .animate-welcome-float, .animate-card-in { animation: none !important; }
        }

        /* Ribbon */
        .ribbon-body {
          border-color: rgba(255,255,255,.6);
          background: linear-gradient(135deg, rgba(255,241,242,.92), rgba(236,254,255,.92) 60%, rgba(254,249,195,.92));
          color: #0a0a0a;
        }
        .dark .ribbon-body {
          border-color: rgb(39 39 42 / .8);
          background: linear-gradient(135deg, rgba(39,39,42,.85), rgba(24,24,27,.85));
          color: #fafafa;
        }
        .ribbon-tail-left, .ribbon-tail-right { position: relative; }
        .ribbon-tail-left::before, .ribbon-tail-right::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,241,242,.92), rgba(236,254,255,.92));
          border: 1px solid rgba(255,255,255,.6);
          border-right: none;
          clip-path: polygon(0 50%, 100% 0, 100% 100%);
          box-shadow: 0 1px 4px rgba(0,0,0,.06) inset;
        }
        .ribbon-tail-right::before { border-right: 1px solid rgba(255,255,255,.6); border-left: none; clip-path: polygon(0 0, 100% 50%, 0 100%); }
        .dark .ribbon-tail-left::before, .dark .ribbon-tail-right::before {
          background: linear-gradient(135deg, rgba(39,39,42,.85), rgba(24,24,27,.85));
          border-color: rgb(39 39 42 / .8);
        }
      `}</style>
    </main>
  );
}

