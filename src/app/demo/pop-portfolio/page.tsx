'use client';

/* =============================================================================
   POP-ART Portfolio (JP/EN)
   - Next.js App Router + Tailwind only
   - Ben-Day dots / comic badges / sunburst rays / panel layout
   - Accessible & responsive
   ========================================================================== */

import React, { useEffect, useRef } from 'react';

/* ----------------------------- Helpers ------------------------------------ */
function useMagnet<T extends HTMLElement>(strength = 0.22) {
  const ref = React.useRef<T | null>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let r = el.getBoundingClientRect();
    let cx = r.left + r.width / 2;
    let cy = r.top + r.height / 2;

    const recalc = () => {
      r = el.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
    };
    const onMove = (e: MouseEvent) => {
      const dx = (e.clientX - cx) * strength;
      const dy = (e.clientY - cy) * strength;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const onLeave = () => (el.style.transform = 'translate(0,0)');

    window.addEventListener('mousemove', onMove);
    window.addEventListener('resize', recalc);
    window.addEventListener('scroll', recalc, { passive: true });
    el.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalc);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [strength]);
  return ref;
}

function cn(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

/* ---- Pastel Tile (淡い色板) ---------------------------------------------- */
const PASTEL_PALETTES: [string, string][] = [
  ['#fff7ed', '#e0f2fe'], // orange-50 → sky-100
  ['#fef9c3', '#e9d5ff'], // yellow-100 → purple-200
  ['#ecfeff', '#fde68a'], // cyan-50 → amber-300
  ['#f5f3ff', '#dcfce7'], // indigo-50 → green-100
  ['#fdf2f8', '#e0e7ff'], // pink-50 → indigo-100
];

function PastelTile({
  label,
  paletteIndex = 0,
  pattern = 'dots', // 'dots' | 'grid' | 'none'
  className = '',
}: {
  label: string;
  paletteIndex?: number;
  pattern?: 'dots' | 'grid' | 'none';
  className?: string;
}) {
  const [c1, c2] = PASTEL_PALETTES[paletteIndex % PASTEL_PALETTES.length];
  const base = `linear-gradient(135deg, ${c1}, ${c2})`;
  const overlay =
    pattern === 'dots'
      ? 'radial-gradient(circle at 2px 2px, rgba(0,0,0,.06) 2px, transparent 2px) 0 0/12px 12px'
      : pattern === 'grid'
      ? 'linear-gradient(rgba(0,0,0,.06) 1px, transparent 1px) 0 0/16px 16px, linear-gradient(90deg, rgba(0,0,0,.06) 1px, transparent 1px) 0 0/16px 16px'
      : '';
  const background = overlay ? `${overlay}, ${base}` : base;

  return (
    <div
      role="img"
      aria-label={label}
      className={cn('h-full w-full', className)}
      style={{ background }}
    />
  );
}


/* --------------------------- Data (demo) ---------------------------------- */
const WORKS = Array.from({ length: 10 }).map((_, i) => ({
  id: i + 1,
  title: `Illustration ${String(i + 1).padStart(2, '0')}`,
  image: `https://picsum.photos/seed/pop${i + 1}/1200/900`,
  tag: ['Girl', 'Chibi', 'Poster', 'Goods', 'Cover'][i % 5],
}));

/* --------------------------- Shared UI ------------------------------------ */
function DotBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full border-4 border-black px-3 py-1 text-xs font-black uppercase tracking-widest shadow-[6px_6px_0_0_#000]"
      style={{
        background:
          'radial-gradient(circle at 2px 2px, #ffd43b 2px, transparent 2px) 0 0/6px 6px, #ffef9a',
      }}
    >
      {children}
    </span>
  );
}

function ComicLabel({
  text,
  color = '#ff006e',
}: {
  text: string;
  color?: string;
}) {
  return (
    <span
      className="inline-block rotate-[-2deg] border-4 border-black px-3 py-1 text-sm font-black shadow-[6px_6px_0_0_#000]"
      style={{
        color: '#000',
        background:
          'radial-gradient(circle at 1.5px 1.5px, rgba(255,255,255,.8) 1.5px, transparent 1.5px) 0 0/5px 5px, white',
        outline: '3px solid #000',
        outlineOffset: '-6px',
        WebkitTextStroke: '0.6px #0000',
        transformOrigin: 'left center',
        boxShadow: '6px 6px 0 0 #000',
        borderColor: '#000',
      }}
    >
      <span className="pr-1" style={{ color }}>{text.split('/')[0]}</span>
      <span className="text-zinc-800">/ {text.split('/')[1]}</span>
    </span>
  );
}

function Sticker({
  label,
  bg = '#00e5ff',
  rotate = -8,
  className,
}: {
  label: string;
  bg?: string;
  rotate?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'pointer-events-none select-none absolute z-10 rounded-2xl border-4 border-black px-4 py-2 text-lg font-black shadow-[8px_8px_0_0_#000]',
        className,
      )}
      style={{
        transform: `rotate(${rotate}deg)`,
        background:
          'radial-gradient(circle at 3px 3px, rgba(255,255,255,.7) 3px, transparent 3px) 0 0/8px 8px,' +
          bg,
      }}
      aria-hidden
    >
      {label}
    </div>
  );
}

/* ----------------------------- Sections ----------------------------------- */
function Nav() {
  const items = [
    { href: '#about', label: 'PROFILE／プロフィール' },
    { href: '#work', label: 'WORK／作品' },
    { href: '#clients', label: 'CLIENTS／取引先' },
    { href: '#contact', label: 'CONTACT／お問い合わせ' },
  ];
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mt-4 rounded-full border-4 border-black bg-white/90 px-4 py-2 shadow-[8px_8px_0_0_#000]">
          <nav className="flex items-center justify-between">
            <a
              href="#top"
              className="text-lg font-black tracking-tight hover:opacity-80"
            >
              POP / PORTFOLIO
            </a>
            <ul className="hidden gap-2 md:flex">
              {items.map((it) => (
                <li key={it.href}>
                  <a
                    href={it.href}
                    className="inline-block rounded-full px-3 py-1 text-sm font-bold hover:bg-yellow-300"
                  >
                    {it.label}
                  </a>
                </li>
              ))}
            </ul>
            <a
              href="#contact"
              className="rounded-full border-4 border-black bg-yellow-300 px-4 py-1 text-sm font-black shadow-[4px_4px_0_0_#000] md:inline-block"
            >
              CONTACT
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const ctaRef = useMagnet<HTMLAnchorElement>(0.2);
  return (
    <section id="top" className="relative overflow-hidden">
      {/* Sunburst rays */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'conic-gradient(from 0deg, #fff 0deg, #fff 10deg, #ffe066 10deg, #ffe066 20deg) center/100% 100% repeat',
          maskImage:
            'radial-gradient(circle at 50% 60%, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 70%)',
          WebkitMaskImage:
            'radial-gradient(circle at 50% 60%, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 70%)',
          opacity: 0.25,
        }}
      />
      {/* Ben-Day dots base */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 2px 2px, #000 1.6px, transparent 1.6px) 0 0/10px 10px, linear-gradient(0deg,#fdf2f8,#fdf2f8)',
          mixBlendMode: 'multiply',
          opacity: 0.08,
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="relative">
          <Sticker
            label="WOW!"
            bg="#ff85a1"
            rotate={-12}
            className="left-[-6px] top-[-18px]"
          />
          <Sticker
            label="BAM!"
            bg="#7df9ff"
            rotate={8}
            className="right-[-10px] bottom-[-26px]"
          />
          <div className="rounded-[32px] border-4 border-black bg-white p-6 shadow-[16px_16px_0_0_#000] md:p-10">
            <div className="grid items-center gap-8 md:grid-cols-[1.1fr_.9fr]">
              <div>
                <DotBadge>COMMISSIONS OPEN／ご依頼受付中</DotBadge>
                <h1 className="mt-4 text-4xl font-black leading-[1.02] tracking-tight md:text-6xl">
                  ポップで<strong className="bg-yellow-300 px-2">楽しく</strong>、
                  ちょっと<strong className="bg-cyan-300 px-2">大胆</strong>。
                  <br />
                  <span className="text-2xl md:text-3xl">Pop illustrations that POP!</span>
                </h1>
                <p className="mt-4 max-w-xl text-zinc-700">
                  女の子・チビキャラ・グッズ映えイラストを中心に、広告／表紙／ポスター／SNSまで幅広く対応。
                  鮮やかな色とコミック的な「勢い」で、目を惹くビジュアルを仕上げます。
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    ref={ctaRef}
                    href="#work"
                    className="relative rounded-full border-4 border-black px-6 py-3 text-sm font-black shadow-[6px_6px_0_0_#000] active:translate-x-[2px] active:translate-y-[2px]"
                    style={{
                      background:
                        'radial-gradient(circle at 3px 3px, rgba(0,0,0,.12) 2px, transparent 2px) 0 0/7px 7px, #ffde59',
                    }}
                  >
                    WORK／作品を見る
                  </a>
                  <a
                    href="#contact"
                    className="rounded-full border-4 border-black bg-white px-6 py-3 text-sm font-black shadow-[6px_6px_0_0_#000] hover:bg-pink-100"
                  >
                    CONTACT／お問い合わせ
                  </a>
                </div>
              </div>
              <div className="relative">
                <img
                  src="https://picsum.photos/seed/pop-hero/1200/900"
                  alt="Hero visual"
                  className="w-full rounded-2xl border-4 border-black object-cover shadow-[12px_12px_0_0_#000]"
                />
                {/* Caption bubble */}
                <div
                  className="absolute -right-2 bottom-[-14px] rounded-2xl border-4 border-black bg-white px-4 py-2 text-xs font-black shadow-[6px_6px_0_0_#000]"
                  style={{
                    background:
                      'radial-gradient(circle at 2px 2px, rgba(0,0,0,.15) 1.4px, transparent 1.4px) 0 0/6px 6px, #fff',
                  }}
                >
                  FEATURED / 注目
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="about" className="relative mx-auto max-w-7xl px-4 py-16 md:py-20">
      <div className="mb-3">
        <ComicLabel text="PROFILE/プロフィール" color="#ff006e" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {/* Comic panel A */}
        <div className="rounded-2xl border-4 border-black bg-white p-5 shadow-[10px_10px_0_0_#000]">
          <h3 className="text-xl font-black">About me</h3>
          <p className="mt-3 text-sm text-zinc-700 leading-relaxed">
            ポップで元気な色使い、太いアウトライン、コミック表現が得意なイラストレーター。
            立ち絵／アイコン／カバー／ポスター／グッズ向けまで幅広く対応します。
          </p>
          <ul className="mt-3 text-sm">
            <li>・拠点：仙台（リモート可）</li>
            <li>・ツール：Clip Studio / Procreate / Photoshop / Illustrator</li>
            <li>・納品：PNG, PSD, Ai など用途に合わせて</li>
          </ul>
        </div>
        {/* Comic panel B */}
        <div className="rounded-2xl border-4 border-black bg-yellow-200 p-5 shadow-[10px_10px_0_0_#000]">
          <h3 className="text-xl font-black">Specialties</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>✅ キャラクターデザイン（等身／SD）</li>
            <li>✅ グッズ・パッケージに映える図案</li>
            <li>✅ 広告・ポスターのインパクト作り</li>
            <li>✅ SNS・配信まわりのアイコン／ヘッダー</li>
          </ul>
        </div>
        {/* Comic panel C */}
        <div className="rounded-2xl border-4 border-black bg-cyan-200 p-5 shadow-[10px_10px_0_0_#000]">
          <h3 className="text-xl font-black">Services</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>• 立ち絵・表紙・ポスター</li>
            <li>• SNSアイコン／ヘッダー</li>
            <li>• 同人誌・CDジャケット</li>
            <li>• アパレル／アクリルスタンド等のグッズ</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Work() {
  const left = WORKS.filter((_, i) => i % 2 === 0);
  const right = WORKS.filter((_, i) => i % 2 === 1);
  return (
    <section id="work" className="relative bg-red-50 py-16 md:py-20">
      {/* Dots overlay */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 2px 2px, #000 1.6px, transparent 1.6px) 0 0/10px 10px',
          opacity: 0.05,
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4">
        <div className="mb-4">
          <ComicLabel text="WORK/作品" color="#1d4ed8" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[left, right].map((col, idx) => (
            <div key={idx} className="grid gap-6">
              {col.map((w) => (
                <figure
                  key={w.id}
                  className="group overflow-hidden rounded-2xl border-4 border-black bg-white shadow-[10px_10px_0_0_#000]"
                >
                  <div className="relative">
                    <img
                      src={w.image}
                      alt={w.title}
                      className="w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                    />
                    <figcaption className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-xl border-4 border-black bg-yellow-200 px-3 py-1 text-xs font-black shadow-[6px_6px_0_0_#000]">
                      <span>{w.title}</span>
                      <span className="rounded bg-white px-2 py-[2px]">{w.tag}</span>
                    </figcaption>
                  </div>
                </figure>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Clients() {
  const names = ['SODA', 'BUBBLE', 'ZAP', 'KAPOW', 'FIZZ', 'BOOM', 'WOW', 'SHINE'];
  return (
    <section id="clients" className="relative mx-auto max-w-7xl px-4 py-16 md:py-20">
      <div className="mb-3">
        <ComicLabel text="CLIENTS/取引先" color="#0ea5e9" />
      </div>
      <div className="overflow-hidden rounded-2xl border-4 border-black bg-white p-5 shadow-[10px_10px_0_0_#000]">
        <div className="animate-[ticker_16s_linear_infinite] whitespace-nowrap">
          {names.concat(names).map((n, i) => (
            <span
              key={i}
              className="mx-6 inline-block rounded-full border-4 border-black bg-yellow-300 px-4 py-1 text-sm font-black shadow-[6px_6px_0_0_#000]"
            >
              {n}
            </span>
          ))}
        </div>
      </div>

      <style jsx global>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}

function Contact() {
  return (
    <section id="contact" className="relative bg-[#fff1f2] py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-3">
          <ComicLabel text="CONTACT/お問い合わせ" color="#ef4444" />
        </div>
        <div className="grid gap-6 md:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-2xl border-4 border-black bg-white p-6 shadow-[10px_10px_0_0_#000]">
            <h3 className="text-2xl font-black">Let’s make it POP!</h3>
            <p className="mt-3 text-sm text-zinc-700">
              ご依頼内容・用途（例：グッズ／表紙／アイコン）・点数・ご予算・希望納期をお知らせください。
              24–48時間以内にご返信いたします。
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href="mailto:hello@example.com?subject=%E3%80%90POP%E3%80%91%E3%81%94%E4%BE%9D%E9%A0%BC%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6"
                className="rounded-full border-4 border-black bg-yellow-300 px-5 py-3 text-sm font-black shadow-[6px_6px_0_0_#000]"
              >
                メールで相談する
              </a>
              <a
                href="https://www.instagram.com/"
                target="_blank"
                className="rounded-full border-4 border-black bg-white px-5 py-3 text-sm font-black shadow-[6px_6px_0_0_#000] hover:bg-pink-100"
              >
                Instagram
              </a>
              <a
                href="https://x.com"
                target="_blank"
                className="rounded-full border-4 border-black bg-white px-5 py-3 text-sm font-black shadow-[6px_6px_0_0_#000] hover:bg-cyan-100"
              >
                X（Twitter）
              </a>
            </div>
          </div>

          <div className="rounded-2xl border-4 border-black bg-white p-6 shadow-[10px_10px_0_0_#000]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                alert('送信ありがとうございます！（デモ） 本番はResend / Supabase等に接続してください。');
              }}
              className="grid gap-3"
            >
              <input
                className="rounded-lg border-4 border-black px-3 py-2"
                placeholder="お名前 / Your name"
                required
              />
              <input
                className="rounded-lg border-4 border-black px-3 py-2"
                type="email"
                placeholder="メールアドレス / Email"
                required
              />
              <textarea
                className="rounded-lg border-4 border-black px-3 py-2"
                rows={4}
                placeholder="ご依頼内容（用途・点数・ご予算・希望納期など）"
              />
              <button
                className="rounded-lg border-4 border-black px-4 py-2 text-sm font-black shadow-[6px_6px_0_0_#000]"
                style={{
                  background:
                    'radial-gradient(circle at 3px 3px, rgba(0,0,0,.12) 2px, transparent 2px) 0 0/7px 7px, #ffde59',
                }}
              >
                送信する／Send
              </button>
            </form>
          </div>
        </div>

        <footer className="mt-8 text-center text-xs">
          © {new Date().getFullYear()} Your Name. All rights reserved.
        </footer>
      </div>
    </section>
  );
}

/* --------------------------------- Page ----------------------------------- */
export default function PopPortfolioPage() {
  useEffect(() => {
    const m = window.matchMedia('(prefers-color-scheme: dark)');
    if (m.matches) document.documentElement.classList.remove('dark'); // ポップは明色推し
  }, []);
  return (
    <main className="relative min-h-screen scroll-smooth bg-white text-zinc-900">
      <Nav />
      <Hero />
      <About />
      <Work />
      <Clients />
      <Contact />
    </main>
  );
}
