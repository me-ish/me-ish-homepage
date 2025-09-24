'use client';

/* =============================================================================
   SCROLL-PLAY (Next.js + Tailwind only)
   "スクロールするたびに何かが起きる" デモページ
   - Scroll progress bar
   - Background color morph (CSS var × scroll)
   - Parallax layers
   - InView reveal
   - Counter up when visible
   - Sticky Pin section with step scenes
   - Magnet CTA
   - Finale confetti
============================================================================== */

import React, { useEffect, useMemo, useRef, useState } from 'react';

/* ----------------------------- Utils / Hooks ------------------------------- */
function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

// スクロールに合わせてCSSカスタムプロパティを更新（0→1の正規化）
function useScrollVar(varName = '--scrollY', max = 1) {
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h =
          document.documentElement.scrollHeight - window.innerHeight || 1;
        const p = Math.min(1, Math.max(0, window.scrollY / h));
        document.documentElement.style.setProperty(varName, String(p * max));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [varName, max]);
}

// IntersectionObserverで「入ったら出現」クラス付与
function useInView<T extends HTMLElement>(opts?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setInView(true);
        });
      },
      { rootMargin: '-10% 0px -10% 0px', threshold: 0.1, ...opts }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [opts]);
  return { ref, inView };
}

// スクロール進捗（0..1）
function useScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h =
          document.documentElement.scrollHeight - window.innerHeight || 1;
        setP(Math.min(1, Math.max(0, window.scrollY / h)));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return p;
}

// 磁力ボタン
function useMagnet<T extends HTMLElement>(strength = 0.25) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
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

/* ----------------------------- Shared bits -------------------------------- */
// パステル板
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
}: {
  label: string;
  index?: number;
  pattern?: 'dots' | 'grid' | 'none';
  className?: string;
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
      className={cn('h-full w-full rounded-2xl border border-white/60 dark:border-zinc-800', className)}
      style={{ background }}
    />
  );
}

/* ----------------------------- Sections ----------------------------------- */
function ProgressBar() {
  const p = useScrollProgress();
  return (
    <div className="fixed left-0 top-0 z-[60] h-1 w-full bg-zinc-200/50 dark:bg-zinc-800/50">
      <div
        className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600 transition-[width]"
        style={{ width: `${p * 100}%` }}
      />
    </div>
  );
}

// 背景カラー変化（:rootの --scrollY を使って色ミックス）
function ColorMorphBg() {
  useScrollVar('--scrollY', 1);
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10"
      style={{
        background:
          'linear-gradient(135deg, rgba(16,185,129,calc(0.25 + var(--scrollY)*0.25)), rgba(59,130,246,calc(0.25 + (1-var(--scrollY))*0.25)))',
        transition: 'background 0.2s linear',
      }}
    />
  );
}

function Nav() {
  const items = [
    { href: '#top', label: 'TOP' },
    { href: '#parallax', label: 'PARALLAX' },
    { href: '#reveal', label: 'REVEAL' },
    { href: '#pin', label: 'PIN' },
    { href: '#finale', label: 'FINALE' },
  ];
  return (
    <header className="sticky top-1 z-50">
      <div className="mx-auto mt-2 max-w-7xl px-4">
        <nav className="flex items-center justify-between rounded-full border border-white/60 bg-white/70 px-3 py-2 shadow-md backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
          <a href="#top" className="font-black tracking-tight">
            SCROLL / PLAY
          </a>
          <ul className="hidden gap-2 md:flex">
            {items.map((it) => (
              <li key={it.href}>
                <a
                  href={it.href}
                  className="inline-block rounded-full px-3 py-1 text-sm hover:bg-zinc-900 hover:text-white"
                >
                  {it.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href="#finale"
            className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-zinc-900 hover:text-white"
          >
            TRY
          </a>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  const ctaRef = useMagnet<HTMLAnchorElement>(0.22);
  return (
    <section id="top" className="relative mx-auto max-w-7xl px-4 pt-28 pb-24 md:pt-40 md:pb-36">
      {/* 優しい光の層 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(75vw 75vw at 0% 0%, rgba(255,0,128,.10), transparent 60%), radial-gradient(60vw 60vw at 100% 0%, rgba(0,160,255,.10), transparent 60%), radial-gradient(120vw 60vw at 50% 100%, rgba(255,200,0,.10), transparent 60%)',
        }}
      />
      <div className="grid gap-10 md:grid-cols-[1.15fr_.85fr] md:items-center">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            SCROLL TO PLAY／スクロールして遊ぶ
          </p>
          <h1 className="text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">
            スクロールで、<br />
            <span className="bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600 bg-clip-text text-transparent">
              次々と起きる演出。
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-zinc-600 dark:text-zinc-400 md:text-lg">
            パララックス／出現アニメ／色変化／ピン留めステップ／最後は紙吹雪まで。
            Next.js + Tailwindだけで、軽量・依存ゼロの仕掛けを詰め込みました。
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              ref={ctaRef}
              href="#parallax"
              className="relative inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white"
              style={{
                background:
                  'conic-gradient(from 180deg at 50% 50%, #10b981, #06b6d4, #2563eb, #10b981)',
                boxShadow:
                  '0 8px 30px rgba(16,185,129,.35), 0 2px 8px rgba(6,182,212,.25)',
              }}
            >
              デモを見る
            </a>
            <a
              href="#finale"
              className="inline-flex items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold hover:bg-zinc-900 hover:text-white"
            >
              最後の仕掛けへ →
            </a>
          </div>
        </div>

        {/* パステル板（ヒーロービジュアル） */}
        <PastelTile label="Feature visual" index={1} pattern="dots" className="aspect-[4/3]" />
      </div>
    </section>
  );
}

function Parallax() {
  // CSS変数 --scrollY を使い、レイヤごとに係数をかける
  return (
    <section id="parallax" className="relative overflow-hidden py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-3xl font-black tracking-tight md:text-4xl">Parallax Layers</h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          スクロール位置に応じて異なる速度で動くレイヤ。CSS変数 × transform なので軽量です。
        </p>
      </div>

      <div className="relative mx-auto mt-10 h-[52vh] max-w-6xl overflow-hidden rounded-3xl border border-white/60 bg-white/60 p-6 shadow-lg backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
        {/* 背面ほどゆっくり、前面ほど速く */}
        <div
          className="absolute left-6 top-6 h-24 w-24 rounded-2xl"
          style={{
            background:
              'radial-gradient(circle at 3px 3px, rgba(0,0,0,.08) 2px, transparent 2px) 0 0/10px 10px, #dcfce7',
            transform:
              'translate3d(calc(var(--scrollY)*-30px), calc(var(--scrollY)*-20px), 0)',
          }}
        />
        <div
          className="absolute right-10 top-16 h-32 w-48 rounded-2xl"
          style={{
            background:
              'radial-gradient(circle at 3px 3px, rgba(0,0,0,.08) 2px, transparent 2px) 0 0/10px 10px, #e9d5ff',
            transform:
              'translate3d(calc(var(--scrollY)*20px), calc(var(--scrollY)*-50px), 0)',
          }}
        />
        <div
          className="absolute bottom-10 left-1/3 h-40 w-64 rounded-2xl"
          style={{
            background:
              'radial-gradient(circle at 3px 3px, rgba(0,0,0,.08) 2px, transparent 2px) 0 0/10px 10px, #fde68a',
            transform:
              'translate3d(calc(var(--scrollY)*-60px), calc(var(--scrollY)*40px), 0)',
          }}
        />
        <div className="relative z-10">
          <PastelTile label="Parallax base" index={3} pattern="grid" className="aspect-[21/9]" />
        </div>
      </div>
    </section>
  );
}

function RevealRow({
  index,
  title,
  desc,
}: {
  index: number;
  title: string;
  desc: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl border border-white/60 bg-white/70 p-6 shadow backdrop-blur transition-all dark:border-zinc-800 dark:bg-zinc-900/60',
        'opacity-0 translate-y-6',
        inView && 'opacity-100 translate-y-0'
      )}
      style={{ transitionDuration: '600ms' }}
    >
      <div className="text-sm text-zinc-500">0{index}</div>
      <div className="mt-1 text-xl font-semibold">{title}</div>
      <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{desc}</div>
      <div className="mt-4">
        <PastelTile label={title} index={index} pattern={index % 2 ? 'dots' : 'grid'} className="aspect-[16/9]" />
      </div>
    </div>
  );
}

function Reveal() {
  const rows = [
    ['出現アニメ', 'スクロールでふわっと登場（IntersectionObserverで一度だけ）'],
    ['カウンタ', '可視領域に入ったら数値が伸びる'],
    ['軽量性', 'トランスフォームとopacityだけでGPUフレンドリー'],
  ] as const;

  return (
    <section id="reveal" className="bg-zinc-50/60 py-24 dark:bg-zinc-950/60 md:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-3xl font-black tracking-tight md:text-4xl">Reveal & Counter</h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          セクションが見えたら出現。数字も可視時にだけカウントアップ。
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {rows.map(([t, d], i) => (
            <RevealRow key={i} index={i + 1} title={t} desc={d} />
          ))}

          <div className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="text-sm text-zinc-500">04</div>
            <div className="mt-1 text-xl font-semibold">Numbers</div>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              下の数字は、このカードが画面に入った瞬間だけ0→目標値に伸びます。
            </p>
            <Counter target={128} duration={1400} className="mt-6" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Counter({
  target,
  duration = 1200,
  className,
}: {
  target: number;
  duration?: number;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setN(Math.round(target * ease));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, duration]);
  return (
    <div ref={ref} className={cn('text-5xl font-black tracking-tight', className)}>
      {n.toLocaleString()}
      <span className="ml-2 text-base font-medium text-zinc-500">views</span>
    </div>
  );
}

// ステップ型ピン留め（stickyコンテナ内で進捗を0..1で算出→文言と色を切替）
function PinScenes() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [prog, setProg] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = r.height - vh;
      const passed = Math.min(total, Math.max(0, -r.top));
      setProg(total > 0 ? passed / total : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  const step = Math.floor(prog * 3); // 0,1,2,3
  const text = [
    'Step 1: 構想を描く（ラフ）',
    'Step 2: 形を固める（線画）',
    'Step 3: 色と質感で仕上げ（着彩）',
    'Step 4: 出力して公開（納品）',
  ][step];

  return (
    <section id="pin" className="py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-3xl font-black tracking-tight md:text-4xl">Sticky / Step Scenes</h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          stickyエリアの内部進捗に応じて文言や色が切り替わる“スライドショー”。
        </p>
      </div>

      <div ref={ref} className="mt-10">
        <div className="sticky top-20 z-10">
          <div className="mx-auto max-w-6xl px-4">
            <div
              className="rounded-3xl border border-white/60 bg-white/70 p-8 shadow backdrop-blur transition-colors dark:border-zinc-800 dark:bg-zinc-900/60"
              style={{
                background:
                  step % 2 === 0
                    ? 'linear-gradient(135deg, #ecfeff, #e9d5ff 60%, #fef9c3)'
                    : 'linear-gradient(135deg, #dcfce7, #bae6fd 60%, #fae8ff)',
              }}
            >
              <div className="text-sm text-zinc-600 dark:text-zinc-400">進捗 {Math.round(prog * 100)}%</div>
              <div className="mt-2 text-2xl font-black">{text}</div>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <PastelTile label="Step visual" index={step} pattern={step % 2 ? 'grid' : 'dots'} className="aspect-[4/3]" />
                <div className="grid gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                  <p>スクロールすると、stickyカードは固定されたまま、背景と内容が移り変わります。</p>
                  <p>ページを重くしないため、transform/opacity中心で演出しています。</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* stickyのスクロール領域を確保するためのスペーサ */}
        <div className="h-[200vh]" />
      </div>
    </section>
  );
}

function Finale() {
  const { ref, inView } = useInView<HTMLDivElement>({ rootMargin: '-5% 0px -5% 0px' });

  // 紙吹雪DOMを生成（軽量の絵文字コンフェッティ）
  const pieces = useMemo(() => {
    return Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.2,
      dur: 2.4 + Math.random() * 1.4,
      rot: (Math.random() - 0.5) * 180,
      emoji: ['🎉', '✨', '🎊', '💫', '🌟'][i % 5],
    }));
  }, []);

  return (
    <section id="finale" className="relative overflow-hidden bg-white/70 py-28 dark:bg-zinc-900/60">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-3xl font-black tracking-tight md:text-4xl">Finale / Confetti</h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          最下部に来たら“お疲れさま”の紙吹雪！クリックでリプレイもできます。
        </p>

        <div
          ref={ref}
          className="relative mt-8 grid place-items-center overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-br from-white to-zinc-50 p-12 text-center shadow dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950"
        >
          <div className="relative z-10">
            <div className="text-4xl font-black">Thanks for scrolling!</div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              もう一度降らせる → ペイン内をクリック / タップ
            </p>
          </div>

          {/* Confetti layer */}
          <Confetti play={inView} />
        </div>
      </div>
    </section>
  );
}

function Confetti({ play }: { play: boolean }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [seed, setSeed] = useState(0); // クリックでリプレイ
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const onClick = () => setSeed((s) => s + 1);
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, []);
  const items = useMemo(
    () =>
      Array.from({ length: 80 }).map((_, i) => ({
        id: i + seed * 1000,
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        dur: 1.6 + Math.random() * 1.6,
        rot: (Math.random() - 0.5) * 180,
        emoji: ['🎉', '✨', '🎊', '💫', '🌟'][i % 5],
      })),
    [seed]
  );

  return (
    <div ref={hostRef} className="pointer-events-auto absolute inset-0">
      {play &&
        items.map((p) => (
          <span
            key={p.id}
            aria-hidden
            className="absolute text-2xl"
            style={{
              left: `${p.left}%`,
              top: '-10%',
              animation: `fall ${p.dur}s ${p.delay}s both cubic-bezier(.2,.7,.2,1)`,
              transform: `rotate(${p.rot}deg)`,
              display: 'inline-block',
            }}
          >
            {p.emoji}
          </span>
        ))}
      <style jsx>{`
        @keyframes fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(110%) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* --------------------------------- Page ----------------------------------- */
export default function ScrollPlayPage() {
  // ダークでも明でもOK。好みで固定したい場合はここで制御
  useEffect(() => {
    // const m = window.matchMedia('(prefers-color-scheme: dark)');
    // if (m.matches) document.documentElement.classList.add('dark');
  }, []);

  return (
    <main className="relative min-h-screen bg-transparent text-zinc-900 dark:text-zinc-50">
      <ColorMorphBg />
      <ProgressBar />
      <Nav />
      <Hero />
      <Parallax />
      <Reveal />
      <PinScenes />
      <Finale />
      <footer className="py-10 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} Your Name — Scroll Play Demo.
      </footer>
    </main>
  );
}
