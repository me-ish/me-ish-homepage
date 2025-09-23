'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

/* ======================== 小物ユーティリティ ============================== */
function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

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
  pattern = 'dots', // 'dots' | 'grid' | 'none'
  className,
  rounded = true,
  thick = false,
}: {
  label: string;
  index?: number;
  pattern?: 'dots' | 'grid' | 'none';
  className?: string;
  rounded?: boolean;
  thick?: boolean;
}) {
  const [c1, c2, c3] = PASTEL[index % PASTEL.length];
  const base = `linear-gradient(135deg, ${c1}, ${c2} 60%, ${c3})`;
  const overlay =
    pattern === 'dots'
      ? 'radial-gradient(circle at 3px 3px, rgba(0,0,0,.08) 2px, transparent 2px) 0 0/10px 10px'
      : pattern === 'grid'
      ? 'linear-gradient(rgba(0,0,0,.06) 1px, transparent 1px) 0 0/16px 16px, linear-gradient(90deg, rgba(0,0,0,.06) 1px, transparent 1px) 0 0/16px 16px'
      : '';
  const background = overlay ? `${overlay}, ${base}` : base;
  return (
    <div
      role="img"
      aria-label={label}
      className={cn('h-full w-full', rounded && 'rounded-2xl', thick ? 'border-2' : 'border', 'border-white/60 dark:border-zinc-800', className)}
      style={{ background }}
    />
  );
}

/* ======================== スクロールスパイ付きナビ ======================== */
export function SmartNav({ sections }: { sections: string[] }) {
  const [active, setActive] = useState<string>('about');
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: 0.01 }
    );
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [sections]);

  const items = [
    { href: '#about', label: 'PROFILE／プロフィール' },
    { href: '#work', label: 'WORK／作品' },
    { href: '#process', label: 'PROCESS／進め方' },
    { href: '#contact', label: 'CONTACT／お問い合わせ' },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur bg-white/70 dark:bg-zinc-950/60 border-b border-white/60 dark:border-zinc-800">
      <div className="mx-auto max-w-7xl px-4">
        <nav className="flex items-center justify-between py-3">
          <a href="#about" className="font-black tracking-tight">
            HYPERFOLIO
          </a>
          <ul className="hidden md:flex gap-2 text-sm">
            {items.map((it) => (
              <li key={it.href}>
                <a
                  href={it.href}
                  className={cn(
                    'inline-block rounded-full px-3 py-1 transition',
                    active === it.href.slice(1)
                      ? 'bg-zinc-900 text-white'
                      : 'hover:bg-zinc-900 hover:text-white'
                  )}
                >
                  {it.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href="#contact"
            className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium hover:bg-zinc-900 hover:text-white transition"
          >
            CONTACT
          </a>
        </nav>
      </div>
    </header>
  );
}

/* ============================== HERO ====================================== */
export function Hero() {
  return (
    <section id="about" className="relative overflow-hidden">
      {/* 軽量レイヤアニメ */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(75vw 75vw at 0% 0%, rgba(255,0,128,.12), transparent 60%), radial-gradient(60vw 60vw at 100% 0%, rgba(0,160,255,.12), transparent 60%), radial-gradient(120vw 60vw at 50% 100%, rgba(255,200,0,.12), transparent 60%)',
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 pt-24 pb-16 md:pt-32 md:pb-24">
        <div className="grid gap-10 md:grid-cols-[1.1fr_.9fr] md:items-center">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs tracking-widest">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              COMMISSIONS OPEN／ご依頼受付中
            </p>
            <h1 className="text-4xl md:text-6xl font-black leading-[1.05] tracking-tight">
              心を動かすイラストを、<br className="hidden md:block" />
              <span className="bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600 bg-clip-text text-transparent">
                最短導線
              </span>
              で届ける一枚。
            </h1>
            <p className="mt-6 text-zinc-600 dark:text-zinc-400 text-base md:text-lg max-w-xl">
              Next.js App Router × Tailwind の軽量実装。Scrollspy／動的OGP／Edge APIで
              “公開してすぐ使える” ポートフォリオ。
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#work"
                className="relative inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white transition active:scale-95"
                style={{
                  background:
                    'conic-gradient(from 180deg at 50% 50%, #10b981, #06b6d4, #2563eb, #10b981)',
                  boxShadow:
                    '0 8px 30px rgba(16,185,129,.35), 0 2px 8px rgba(6,182,212,.25)',
                }}
              >
                WORK／作品を見る
              </a>
              <a
                href="#contact"
                className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-900 hover:text-white transition"
              >
                CONTACT／お問い合わせ
              </a>
            </div>
          </div>

          {/* 右側ビジュアル：写真を使わずに実装例を示すパステル板 */}
          <div className="relative">
            <div className="aspect-[4/3] w-full rounded-2xl shadow-2xl">
              <PastelTile label="Feature visual" index={1} pattern="dots" className="h-full w-full rounded-2xl" />
            </div>
            <div className="absolute left-4 bottom-4 rounded-xl bg-white/80 dark:bg-zinc-900/70 backdrop-blur px-4 py-2 text-sm font-medium">
              Production-minded • 2025
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================== WORK ====================================== */
type Project = { id: number; title: string; tag: string };

export async function WorkGrid({ projects }: { projects: Project[] }) {
  return <ClientWorkGrid initial={projects} />;
}

function ClientWorkGrid({ initial }: { initial: Project[] }) {
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string>('ALL');

  const tags = useMemo(
    () => Array.from(new Set(['ALL', ...initial.map((p) => p.tag)])),
    [initial]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return initial.filter(
      (p) =>
        (tag === 'ALL' || p.tag === tag) &&
        (s === '' || p.title.toLowerCase().includes(s))
    );
  }, [initial, q, tag]);

  return (
    <>
      <div className="mt-8 flex flex-wrap gap-2">
        {tags.map((t) => (
          <button
            key={t}
            onClick={() => setTag(t)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm',
              tag === t ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-900 hover:text-white'
            )}
          >
            {t}
          </button>
        ))}
        <div className="ml-auto">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="検索（タイトル）"
            className="rounded-full border px-3 py-1 text-sm bg-white/90 dark:bg-zinc-900/60"
          />
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {[0, 1].map((col) => (
          <div key={col} className="grid gap-6">
            {filtered
              .filter((_, i) => i % 2 === col)
              .map((p) => (
                <figure
                  key={p.id}
                  className="group overflow-hidden rounded-2xl border bg-white dark:bg-zinc-900 border-white/60 dark:border-zinc-800 shadow"
                >
                  <div className="relative">
                    <PastelTile
                      label={p.title}
                      index={p.id}
                      pattern={p.id % 3 === 0 ? 'grid' : 'dots'}
                      className="aspect-[4/3]"
                      rounded={false}
                    />
                    <figcaption className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-xl bg-white/85 dark:bg-zinc-900/75 backdrop-blur px-3 py-2 text-sm">
                      <span className="font-medium">{p.title}</span>
                      <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs">{p.tag}</span>
                    </figcaption>
                  </div>
                </figure>
              ))}
          </div>
        ))}
      </div>
    </>
  );
}

/* ============================== PROCESS =================================== */
export function Process() {
  const steps = [
    ['ヒアリング', '用途・テイスト・納期・予算の確認'],
    ['ラフ提案', '方向性を共有（1–2案）'],
    ['清書・仕上げ', '配色・質感の詰め'],
    ['納品', 'PNG/PSD/Aiなど用途に合わせて'],
  ] as const;

  return (
    <section id="process" className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-zinc-500">
          <span>PROCESS</span><span>／</span><span>進め方</span>
        </div>
        <h2 className="mt-2 text-3xl md:text-4xl font-black tracking-tight">How we work</h2>

        <ol className="mt-10 grid gap-6 md:grid-cols-4">
          {steps.map(([title, desc], i) => (
            <li key={i} className="rounded-2xl border border-white/60 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow">
              <div className="text-2xl font-black">0{i + 1}</div>
              <div className="mt-2 font-semibold">{title}</div>
              <div className="mt-1 text-sm text-zinc-500">{desc}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ============================== CONTACT =================================== */
export function Contact() {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    setState('sending');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      setState('ok');
      formRef.current.reset();
    } catch (err) {
      setState('err');
    }
  }

  return (
    <section id="contact" className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
      <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-zinc-500">
        <span>CONTACT</span><span>／</span><span>お問い合わせ</span>
      </div>

      <div className="mt-3 relative overflow-hidden rounded-3xl border border-white/60 dark:border-zinc-800 bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950 p-8 md:p-14">
        <div className="absolute -left-10 -top-10 h-56 w-56 rounded-full bg-gradient-to-br from-emerald-400/30 to-cyan-400/30 blur-3xl" />
        <div className="absolute -right-10 -bottom-10 h-56 w-56 rounded-full bg-gradient-to-br from-blue-500/20 to-emerald-400/20 blur-3xl" />

        <div className="relative grid gap-8 md:grid-cols-[1.1fr_.9fr] md:items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">お仕事のご依頼・ご相談</h2>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              用途・点数・ご予算・希望納期をお知らせください。通常24–48h以内にご連絡します。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="mailto:hello@example.com?subject=%E4%BC%9A%E7%A4%BE%E5%90%8D%E3%80%81%E4%BE%9D%E9%A0%BC%E5%86%85%E5%AE%B9"
                className="inline-flex items-center rounded-full px-6 py-3 text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #10b981, #2563eb)' }}
              >
                hello@example.com
              </a>
              <a
                href="https://x.com"
                target="_blank"
                className="inline-flex items-center rounded-full px-6 py-3 text-sm font-semibold border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-900 hover:text-white transition"
              >
                X / Twitter
              </a>
              <a
                href="https://www.instagram.com/"
                target="_blank"
                className="inline-flex items-center rounded-full px-6 py-3 text-sm font-semibold border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-900 hover:text-white transition"
              >
                Instagram
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-white/60 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 backdrop-blur p-6">
            <form ref={formRef} onSubmit={onSubmit} className="grid gap-4">
              <input name="name" className="rounded-lg border px-3 py-2 bg-white/90 dark:bg-zinc-950/60" placeholder="お名前 / Your name" required />
              <input name="email" className="rounded-lg border px-3 py-2 bg-white/90 dark:bg-zinc-950/60" type="email" placeholder="メールアドレス / Email" required />
              <textarea name="message" className="rounded-lg border px-3 py-2 bg-white/90 dark:bg-zinc-950/60" rows={4} placeholder="ご依頼内容・用途・点数・希望納期など" />
              <button
                disabled={state === 'sending'}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #7c3aed)' }}
              >
                {state === 'sending' ? '送信中…' : state === 'ok' ? '送信しました！' : '送信する／Send'}
              </button>
              {state === 'err' && (
                <p className="text-xs text-red-600">
                  送信に失敗しました。しばらく経ってからお試しください。
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================== FOOTER ==================================== */
export function Footer() {
  return (
    <footer className="mt-10 pb-10 text-center text-xs text-zinc-500">
      © {new Date().getFullYear()} Your Name. Built with Next.js App Router & Tailwind CSS.
    </footer>
  );
}
