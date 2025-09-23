/* eslint-disable jsx-a11y/anchor-is-valid */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Hero, SmartNav, WorkGrid, Process, Contact, Footer } from './sections';

// ====== SEO / OGP（大きいカード + JSON-LD） =================================
export const metadata: Metadata = {
  title: 'Hyperfolio — One-Page Portfolio (Next.js + Tailwind)',
  description:
    'Illustration-first one-pager built on Next.js App Router. Fast, accessible, and production-minded.',
  openGraph: {
    title: 'Hyperfolio — One-Page Portfolio',
    description:
      'Next.js App Router + Tailwind. Scrollspy, Edge API contact, dynamic OG, JSON-LD.',
    url: 'https://your-domain.com/demo/hyperfolio',
    siteName: 'Hyperfolio',
    images: [{ url: '/api/og?title=Hyperfolio', width: 1200, height: 630 }],
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@your_handle',
    creator: '@your_handle',
  },
  alternates: { canonical: 'https://your-domain.com/demo/hyperfolio' },
};

export default async function Page() {
  // サーバー側でデータ（ダミー）。本番ではDBやSupabase等に差し替え。
  const projects = getProjects();

  return (
    <main className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 antialiased selection:bg-emerald-200/60">
      {/* Stickyナビ（Scrollspy内蔵のClient Component） */}
      <SmartNav sections={['about', 'work', 'process', 'contact']} />

      {/* Hero（サーバーで即描画 / 裏でLazy hydrate） */}
      <Hero />

      {/* Workセクションはフィルタ等のCSRを含むのでSuspenseでフォールバック */}
      <section id="work" className="py-20 md:py-28 bg-zinc-50/60 dark:bg-zinc-950/60">
        <div className="mx-auto max-w-6xl px-4">
          <header className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-zinc-500">
                <span>WORK</span><span>／</span><span>作品</span>
              </div>
              <h2 className="mt-2 text-3xl md:text-4xl font-black tracking-tight">
                Selected Works
              </h2>
            </div>
            <a href="#contact" className="text-sm underline underline-offset-4">
              コラボ・ご依頼はこちら →
            </a>
          </header>

          <Suspense fallback={<p className="mt-10 text-sm text-zinc-500">Loading works…</p>}>
            <WorkGrid projects={projects} />
          </Suspense>
        </div>
      </section>

      <Process />

      <Contact />

      <Footer />

      {/* JSON-LD（構造化データ：ポートフォリオ/Person想定） */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: 'Your Name',
            url: 'https://your-domain.com',
            sameAs: ['https://x.com/your_handle', 'https://www.instagram.com/your_handle'],
            knowsAbout: ['Illustration', 'Character Design', 'Goods Design'],
            worksFor: { '@type': 'Organization', name: 'me-ish' },
          }),
        }}
      />
    </main>
  );
}

// ====== Demo Data（Server） ==================================================
function getProjects() {
  const TAGS = ['イラスト', 'キャラ', 'グッズ', '表紙', 'アイコン'] as const;
  return Array.from({ length: 12 }).map((_, i) => ({
    id: i + 1,
    title: `Artwork ${String(i + 1).padStart(2, '0')}`,
    tag: TAGS[i % TAGS.length],
  }));
}
