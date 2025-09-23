'use client';

/* ============================================================================
   One-Page Portfolio (Surprise Edition)
   - No extra deps. Tailwind only.
   - Parallax hero / magnetic buttons / 3D-tilt cards / marquee / masonry gallery
   - Accessible & responsive
   ============================================================================ */

import React, { useEffect, useMemo, useRef, useState } from 'react';

// ----------------------------- Helpers ---------------------------------------
function useParallax(mult = 0.03) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const { innerWidth: w, innerHeight: h } = window;
      const x = (e.clientX - w / 2) * mult;
      const y = (e.clientY - h / 2) * mult;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [mult]);
  return ref;
}

// 置き換え：HTMLButtonElement 固定 → ジェネリック HTMLElement
function useMagnet<T extends HTMLElement>(strength = 0.25) {
  const ref = React.useRef<T | null>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const rect = () => el.getBoundingClientRect();
    let r = rect();
    const center = () => {
      r = rect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    };
    let { cx, cy } = center();

    const onMove = (e: MouseEvent) => {
      // スクロールで位置が変わるので都度追従させたい場合は次行のコメント解除
      // ({ cx, cy } = center());
      const dx = (e.clientX - cx) * strength;
      const dy = (e.clientY - cy) * strength;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const onLeave = () => (el.style.transform = 'translate(0,0)');
    const onResize = () => ({ cx, cy } = center());

    window.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize);
    };
  }, [strength]);

  return ref;
}


function cn(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

// --------------------------- Demo Data ---------------------------------------
const ARTWORKS = Array.from({ length: 16 }).map((_, i) => ({
  id: i + 1,
  title: `Project ${String(i + 1).padStart(2, '0')}`,
  // Royalty-free placeholder from picsum:
  image: `https://picsum.photos/seed/port${i + 1}/1200/900`,
  tag: ['Illustration', 'UI/UX', 'Branding', '3D', 'Photo'][i % 5],
}));

const LOGOS = [
  'AURORA', 'POLAR', 'MOSS', 'NEBULA', 'LYNX', 'CINDER', 'ORBIT', 'NOVA',
];

// --------------------------- Sections ----------------------------------------
function Nav() {
  const [open, setOpen] = useState(false);
  const items = [
    { href: '#about', label: 'About' },
    { href: '#work', label: 'Work' },
    { href: '#skills', label: 'Skills' },
    { href: '#timeline', label: 'Timeline' },
    { href: '#contact', label: 'Contact' },
  ];
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mt-4 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/80 dark:bg-zinc-900/80 border border-white/60 dark:border-zinc-800 rounded-full shadow-lg">
          <nav className="flex items-center justify-between px-4 py-2">
            <a href="#top" className="font-black tracking-tight text-lg">
              <span className="sr-only">Back to top</span>
              <span className="inline-block bg-gradient-to-r from-fuchsia-600 via-rose-500 to-orange-400 bg-clip-text text-transparent">
                YOU / PORTFOLIO
              </span>
            </a>
            <button
              onClick={() => setOpen((v) => !v)}
              className="md:hidden rounded-full px-3 py-1 text-sm font-medium border border-zinc-300 dark:border-zinc-700"
            >
              Menu
            </button>
            <ul className="hidden md:flex gap-2 text-sm">
              {items.map((it) => (
                <li key={it.href}>
                  <a
                    href={it.href}
                    className="inline-block rounded-full px-3 py-1 hover:bg-zinc-900 hover:text-white transition"
                  >
                    {it.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {open && (
            <ul className="md:hidden grid grid-cols-2 gap-2 p-3 border-t border-zinc-200 dark:border-zinc-800">
              {items.map((it) => (
                <li key={it.href}>
                  <a
                    onClick={() => setOpen(false)}
                    href={it.href}
                    className="block rounded-lg px-3 py-2 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-900 hover:text-white transition"
                  >
                    {it.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const ref = useParallax(0.02);
  const ctaRef = useMagnet<HTMLAnchorElement>(0.2);
  return (
    <section id="top" className="relative overflow-hidden">
      {/* Background layers */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(75vw 75vw at 0% 0%, rgba(255,0,128,.18), transparent 60%), radial-gradient(60vw 60vw at 100% 0%, rgba(0,160,255,.18), transparent 60%), radial-gradient(120vw 60vw at 50% 100%, rgba(255,200,0,.16), transparent 60%)',
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-multiply [background-image:linear-gradient(transparent,transparent_31px,#0000000d_32px),linear-gradient(90deg,transparent,transparent_31px,#0000000d_32px)] [background-size:32px_32px]" />

      <div className="relative mx-auto max-w-7xl px-4 pt-28 pb-24 md:pt-40 md:pb-36">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-widest">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Available for commissions
            </p>
            <h1 className="text-4xl md:text-6xl font-black leading-[1.05] tracking-tight">
              Design that
              <span className="relative inline-block ml-2">
                <span className="relative z-10 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600 bg-clip-text text-transparent">
                  moves
                </span>
                <span
                  aria-hidden
                  ref={ref}
                  className="absolute -inset-x-2 -inset-y-3 rounded-xl blur-2xl bg-gradient-to-r from-emerald-500/50 via-cyan-500/50 to-blue-600/50"
                />
              </span>
              people.
            </h1>
            <p className="mt-6 text-zinc-600 dark:text-zinc-400 text-base md:text-lg max-w-xl">
              I craft bold, performant interfaces where every pixel has a job.
              From identity to interactive art—let’s make something unforgettable.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#work"
                ref={ctaRef}
                className="relative inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white transition active:scale-95"
                style={{
                  background:
                    'conic-gradient(from 180deg at 50% 50%, #10b981, #06b6d4, #2563eb, #10b981)',
                  boxShadow:
                    '0 8px 30px rgba(16,185,129,.35), 0 2px 8px rgba(6,182,212,.25)',
                }}
              >
                See my work
              </a>
              <a
                href="#contact"
                className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-900 hover:text-white transition"
              >
                Contact
              </a>
            </div>
          </div>

          {/* Tilt card */}
          <TiltCard />
        </div>

        {/* Scrolling marquee of “clients” */}
        <div className="mt-16 overflow-hidden">
          <div className="flex items-center gap-8 text-zinc-500 dark:text-zinc-400">
            <span className="text-xs uppercase tracking-widest">Selected collabs</span>
            <div className="relative w-full">
              <div className="animate-[marquee_18s_linear_infinite] whitespace-nowrap">
                {LOGOS.concat(LOGOS).map((name, idx) => (
                  <span key={idx} className="mx-6 inline-block text-sm opacity-80">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}

function TiltCard() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      const rx = (+y / r.height) * -15;
      const ry = (+x / r.width) * 15;
      el.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    };
    const reset = () => (el.style.transform = 'rotateX(0) rotateY(0)');
    window.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', reset);
    return () => {
      window.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', reset);
    };
  }, []);
  return (
    <div className="relative">
      <div
        ref={ref}
        className="aspect-[4/3] w-full rounded-2xl border border-white/40 dark:border-zinc-800 bg-gradient-to-br from-white to-zinc-100 dark:from-zinc-900 dark:to-zinc-950 shadow-2xl transition-transform duration-200 will-change-transform"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div className="absolute inset-0 rounded-2xl overflow-hidden">
          <img
            className="h-full w-full object-cover opacity-95"
            src="https://picsum.photos/seed/hero/1400/900"
            alt="Feature visual"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>
        <div
          className="absolute left-4 bottom-4 rounded-xl bg-white/80 dark:bg-zinc-900/70 backdrop-blur px-4 py-2 text-sm font-medium"
          style={{ transform: 'translateZ(30px)' }}
        >
          Winner — Interactive Design 2025
        </div>
        <div
          className="absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{
            transform: 'translateZ(50px)',
            background:
              'linear-gradient(135deg, #10b981, #06b6d4 50%, #2563eb)',
          }}
        >
          Featured
        </div>
      </div>
    </div>
  );
}

function About() {
  return (
    <section id="about" className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
      <div className="grid gap-10 md:grid-cols-[1.1fr_.9fr] md:items-center">
        <div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">About</h2>
          <p className="mt-6 text-zinc-600 dark:text-zinc-400 leading-relaxed">
            I’m a multidisciplinary designer bridging illustration, brand, and interactive
            systems. My work focuses on clarity, rhythm, and tiny delightful details that
            reward curiosity. I love fast teams, bold ideas, and shipping.
          </p>
          <ul className="mt-6 grid gap-2 text-sm">
            <li>• Based in Sendai / Remote friendly</li>
            <li>• Tools: Figma, Procreate, Blender (basic), Next.js, Tailwind</li>
            <li>• Services: Art direction, UI/UX, visual identity, web builds</li>
          </ul>
        </div>
        <div className="relative">
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-emerald-400/20 via-cyan-400/20 to-blue-400/20 blur-2xl" />
          <div className="relative rounded-3xl overflow-hidden border border-white/60 dark:border-zinc-800 shadow-xl">
            <img src="https://picsum.photos/seed/meish-portrait/1200/900" alt="Portrait" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Work() {
  // Split into two columns (masonry)
  const left = ARTWORKS.filter((_, i) => i % 2 === 0);
  const right = ARTWORKS.filter((_, i) => i % 2 === 1);

  return (
    <section id="work" className="bg-zinc-50/60 dark:bg-zinc-950/60 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-end justify-between">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">Selected Work</h2>
          <a href="#contact" className="text-sm underline underline-offset-4">Let’s collaborate →</a>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {[left, right].map((col, idx) => (
            <div key={idx} className="grid gap-6">
              {col.map((w) => (
                <figure key={w.id} className="group overflow-hidden rounded-2xl border bg-white dark:bg-zinc-900 border-white/60 dark:border-zinc-800 shadow">
                  <div className="relative">
                    <img
                      src={w.image}
                      alt={w.title}
                      className="w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                    <figcaption className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-xl bg-white/85 dark:bg-zinc-900/75 backdrop-blur px-3 py-2 text-sm">
                      <span className="font-medium">{w.title}</span>
                      <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs">{w.tag}</span>
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

function Skills() {
  const items = [
    { label: 'UI/UX', v: 0.92 },
    { label: 'Brand', v: 0.86 },
    { label: 'Illustration', v: 0.9 },
    { label: 'Motion', v: 0.7 },
    { label: '3D', v: 0.55 },
    { label: 'Frontend', v: 0.78 },
  ];
  return (
    <section id="skills" className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
      <h2 className="text-3xl md:text-4xl font-black tracking-tight">Skills</h2>
      <div className="mt-10 grid grid-cols-2 md:grid-cols-3 gap-6">
        {items.map((it) => (
          <div
            key={it.label}
            className="rounded-2xl border border-white/60 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow"
          >
            <div
              className="mx-auto mb-4 aspect-square w-28 rounded-full"
              style={{
                background: `conic-gradient(#10b981 ${it.v * 360}deg, #e5e7eb 0deg)`,
              }}
              aria-hidden
            />
            <div className="text-center font-semibold">{it.label}</div>
            <div className="mt-1 text-center text-sm text-zinc-500">{Math.round(it.v * 100)}%</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Timeline() {
  const items = [
    ['2025', 'Launched “FLOAT” gallery and shipped COA feature'],
    ['2024', 'Built interactive gallery with R3F, initiated artist program'],
    ['2023', 'Started freelance design, shipped 20+ small websites'],
  ];
  return (
    <section id="timeline" className="bg-white/60 dark:bg-zinc-900/60 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-3xl md:text-4xl font-black tracking-tight">Timeline</h2>
        <div className="mt-8 relative">
          <div className="absolute left-4 md:left-1/2 -translate-x-1/2 h-full w-px bg-gradient-to-b from-transparent via-zinc-300 dark:via-zinc-700 to-transparent" />
          <ul className="space-y-8">
            {items.map(([year, text], i) => (
              <li key={i} className="relative grid md:grid-cols-2 gap-6 items-start">
                <div className={cn(
                  'md:text-right',
                  i % 2 === 1 && 'md:col-start-2'
                )}>
                  <div className="inline-flex items-center gap-3">
                    <span className="text-2xl font-black">{year}</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  </div>
                  <p className="mt-2 text-zinc-600 dark:text-zinc-400">{text}</p>
                </div>
                <div className={cn(i % 2 === 1 ? 'md:col-start-1' : 'md:col-start-2')}>
                  <div className="rounded-2xl overflow-hidden border border-white/60 dark:border-zinc-800">
                    <img src={`https://picsum.photos/seed/tl${i}/1200/700`} alt="" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section id="contact" className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
      <div className="relative overflow-hidden rounded-3xl border border-white/60 dark:border-zinc-800 bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950 p-8 md:p-14">
        <div className="absolute -left-10 -top-10 h-56 w-56 rounded-full bg-gradient-to-br from-emerald-400/30 to-cyan-400/30 blur-3xl" />
        <div className="absolute -right-10 -bottom-10 h-56 w-56 rounded-full bg-gradient-to-br from-blue-500/20 to-emerald-400/20 blur-3xl" />
        <div className="relative grid gap-8 md:grid-cols-[1.1fr_.9fr] md:items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Let’s build something vivid.</h2>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              Commissions, collabs, or just say hi. I reply within 24–48h.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="mailto:hello@example.com?subject=Portfolio%20Inquiry"
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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                alert('Thanks! This is a demo form. Plug into Resend / Supabase as needed.');
              }}
              className="grid gap-4"
            >
              <input className="rounded-lg border px-3 py-2 bg-white/90 dark:bg-zinc-950/60" placeholder="Your name" required />
              <input className="rounded-lg border px-3 py-2 bg-white/90 dark:bg-zinc-950/60" type="email" placeholder="Email" required />
              <textarea className="rounded-lg border px-3 py-2 bg-white/90 dark:bg-zinc-950/60" rows={4} placeholder="Project details…" />
              <button
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #7c3aed)' }}
              >
                Send inquiry
              </button>
            </form>
          </div>
        </div>
      </div>
      <footer className="mt-10 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} Your Name. All rights reserved.
      </footer>
    </section>
  );
}

// ----------------------------- Page ------------------------------------------
export default function PortfolioPage() {
  // prefer-dark if user set
  useEffect(() => {
    const m = window.matchMedia('(prefers-color-scheme: dark)');
    if (m.matches) document.documentElement.classList.add('dark');
  }, []);
  return (
    <main className="relative min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <Nav />
      <Hero />
      <About />
      <Work />
      <Skills />
      <Timeline />
      <Contact />
    </main>
  );
}
