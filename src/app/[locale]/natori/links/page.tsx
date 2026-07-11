'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Link data                                                           */
/* ------------------------------------------------------------------ */
const LINKS = [
  {
    label: 'ポートフォリオ',
    sub: 'ご依頼・コミッションはこちら',
    href: '/natori/portfolio',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
        <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.1-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9Zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 8 6.5 8 8 8.67 8 9.5 7.33 11 6.5 11Zm3-4C8.67 7 8 6.33 8 5.5S8.67 4 9.5 4s1.5.67 1.5 1.5S10.33 7 9.5 7Zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 4 14.5 4s1.5.67 1.5 1.5S15.33 7 14.5 7Zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 8 17.5 8s1.5.67 1.5 1.5-.67 1.5-1.5 1.5Z" />
      </svg>
    ),
  },
  {
    label: 'X（Twitter）',
    sub: '@natonato_o',
    href: 'https://x.com/natonato_o',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.265 5.64 5.899-5.64Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
      </svg>
    ),
  },
  {
    label: 'TikTok',
    sub: '@natori_draw',
    href: 'https://www.tiktok.com/@natori_n?_r=1&_t=ZS-95f2mTSsI5c',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.77 1.52V6.77a4.85 4.85 0 0 1-1-.08Z" />
      </svg>
    ),
  },
  {
    label: 'Wick',
    sub: 'コミュニティ',
    href: 'https://wick-share.com/sns/share/lXY3b8Gw',
    icon: null,
    iconText: 'W',
  },
  {
    label: 'つなぐ',
    sub: 'フォローはこちら',
    href: 'https://tsunagu.cloud/users/natonato_o',
    icon: null,
    iconText: 'つ',
  },
  {
    label: 'BOOTH',
    sub: 'グッズ・同人誌',
    href: 'https://natori0716.booth.pm/',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
      </svg>
    ),
    iconText: 'B',
  },
  {
    label: 'Skeb',
    sub: 'コミッション受付中',
    href: 'https://skeb.jp/@natonato_o',
    icon: null,
    iconText: 'S',
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */
export default function Page() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const delay = mq.matches ? 0 : 80;
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, []);

  return (
    <main
      className="relative min-h-svh overflow-x-hidden"
      style={{
        background: 'linear-gradient(160deg, #fce4ec 0%, #f8bbd0 30%, #ffd6e7 60%, #ffe0f0 100%)',
      }}
    >
      {/* 背景の装飾円 */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-32 -left-32 h-96 w-96 rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, #f48fb1, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full opacity-25"
          style={{ background: 'radial-gradient(circle, #ce93d8, transparent 70%)' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #f06292, transparent 70%)' }}
        />
      </div>

      {/* コンテンツ */}
      <div className="relative z-10 mx-auto flex max-w-sm flex-col items-center px-5 py-14 pb-20">

        {/* ── アイコン ── */}
        <div
          className="transition-all duration-700"
          style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-16px)' }}
        >
          <div
            className="relative h-28 w-28 overflow-hidden rounded-full shadow-xl ring-4 ring-white"
            style={{ boxShadow: '0 0 0 4px #ffffff, 0 8px 32px rgba(236,64,122,0.25)' }}
          >
            <Image
              src="/natori/IMG_3825.jpeg"
              alt="ナトリ"
              fill
              className="object-cover"
              priority
            />
          </div>
        </div>

        {/* ── 名前 ── */}
        <div
          className="mt-4 text-center transition-all duration-700 delay-100"
          style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-10px)' }}
        >
          <h1 className="text-2xl font-black tracking-wider text-pink-900/90">ナトリ</h1>
          <p className="mt-1 text-sm text-pink-700/70">イラストレーター</p>
        </div>

        {/* ── リンク一覧 ── */}
        <ul className="mt-9 w-full space-y-3.5">
          {LINKS.map((lk, i) => (
            <li
              key={lk.label}
              className="transition-all duration-500"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(20px)',
                transitionDelay: `${200 + i * 80}ms`,
              }}
            >
              <a
                href={lk.href}
                target={lk.href.startsWith('/') ? undefined : '_blank'}
                rel={lk.href.startsWith('/') ? undefined : 'noopener noreferrer'}
                aria-label={`${lk.label} へ移動`}
                className="group flex items-center gap-4 rounded-2xl px-5 py-4 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
                style={{
                  background: '#ffffff',
                  border: '1px solid #ffffff',
                }}
              >
                {/* アイコン枠 */}
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-pink-500 shadow-sm transition-colors group-hover:text-pink-600"
                  style={{ background: 'linear-gradient(135deg, #fce4ec, #ffd6e7)' }}
                >
                  {lk.icon ?? (
                    <span className="text-base font-black">{(lk as any).iconText}</span>
                  )}
                </span>

                {/* テキスト */}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-pink-900/90">{lk.label}</div>
                  {'sub' in lk && lk.sub && (
                    <div className="truncate text-xs text-pink-500/80">{lk.sub}</div>
                  )}
                </div>

                {/* 矢印 */}
                <svg
                  viewBox="0 0 20 20"
                  className="h-4 w-4 shrink-0 text-pink-300 transition-transform group-hover:translate-x-0.5"
                  fill="currentColor"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            </li>
          ))}
        </ul>

        {/* フッター */}
        <footer
          className="mt-12 text-center text-xs text-pink-400/70 transition-all duration-700 delay-[800ms]"
          style={{ opacity: visible ? 1 : 0 }}
        >
          © {new Date().getFullYear()} Natori. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
