// C:\me-ish-next\src\components\MobileHome.tsx
'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, ArrowRight, ShieldCheck, Images, Sparkles } from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';
import { useAnnouncements } from '@/hooks/useAnnouncements';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { SectionHeader } from '@/components/shared/SectionHeader';

/* ──────────────────────────────────────────────────────────────
   Layout Tokens（モバイル用）
   - 統一されたコンテナ幅・余白・セクション間隔
────────────────────────────────────────────────────────────── */
const LAYOUT = {
  container: 'mx-auto w-full max-w-[680px]',
  sectionX: 'px-5',
  sectionY: 'py-10',
  sectionYCompact: 'py-8',
} as const;

/* ──────────────────────────────────────────────────────────────
   Card Styles（モバイル用）
   - ガラス感/レイヤー効果の統一スタイル
────────────────────────────────────────────────────────────── */
const CARD = {
  base: 'rounded-2xl bg-white/80 backdrop-blur-sm ring-1 ring-[#00a1e9]/10 border border-white/60 shadow-sm',
  solid: 'rounded-2xl bg-white ring-1 ring-[#00a1e9]/8 border border-gray-100/80 shadow-sm',
  interactive: 'active:scale-[0.995] transition-all duration-200',
} as const;

/* ──────────────────────────────────────────────────────────────
   スクロール時のフェードイン（reduced-motion対応）
────────────────────────────────────────────────────────────── */
function useFadeInOnScroll() {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const targets = document.querySelectorAll<HTMLElement>('.fade-in-start');

    if (prefersReducedMotion) {
      targets.forEach((t) => t.classList.add('show'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('show');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);
}

/* ──────────────────────────────────────────────────────────────
   背景レイヤー: Hero用（Desktopと統一 / fixed）
────────────────────────────────────────────────────────────── */
function HeroBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Radial glow（上部・下部） */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-5%,_rgba(0,161,233,0.14),_transparent_55%),radial-gradient(ellipse_70%_40%_at_50%_110%,_rgba(0,161,233,0.08),_transparent_50%)]" />

      {/* 微細グリッド（モバイルは少し薄め） */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,161,233,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,161,233,0.5) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
    </div>
  );
}

const MobileHome = () => {
  useFadeInOnScroll();

return (
  <div className="font-zen text-[#222] bg-white">
    <HeroBackground />

    {/* ヘッダー分の余白（モバイルはやや低め） */}
    <main className="pt-[64px] relative z-10">
{/* Hero：Desktopと同じ導線（ギャラリー / 応募） */}
<section
  className={`relative ${LAYOUT.sectionX} py-14 text-center`}
  aria-labelledby="hero-title"
>
  <div className="fade-in-start">
    <h1
      id="hero-title"
      className="font-lilita font-bold leading-none text-[#00a1e9] tracking-tight text-[clamp(2.4rem,12vw,3.4rem)]"
    >
      me-ish
    </h1>

    <p className="text-[#00a1e9]/80 uppercase tracking-[0.22em] mt-1 text-[clamp(0.8rem,3.2vw,1rem)]">
      — online gallery —
    </p>

    <p className="mt-6 text-[clamp(1.05rem,5vw,1.4rem)] text-[#333]">
      アートを、もっと近くに
    </p>

    {/* CTA Buttons（Desktopと統一） */}
    <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
      <Button
        asChild
        size="lg"
        className="rounded-full px-6 py-3 h-auto text-base font-semibold shadow-md active:scale-[0.98] transition-all duration-200"
      >
        <Link href="/white" aria-label="ギャラリーを見る">
          ギャラリーを見る <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>

      <Button
        asChild
        variant="outline"
        size="lg"
        className="rounded-full px-6 py-3 h-auto text-base font-semibold border-[#00a1e9] text-[#00a1e9] active:scale-[0.98] hover:bg-[#e8f7ff] hover:text-[#00a1e9] transition-all duration-200"
      >
        <Link href="/entry" aria-label="応募する">
          応募する <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>

    <Link
      href="/modal/about"
      className="mt-8 inline-block text-sm text-[#00a1e9]/70 hover:text-[#00a1e9] transition-colors"
    >
      もっと見る
    </Link>
  </div>
</section>
        {/* お知らせ */}
        <section
          id="news"
          className={`fade-in-start ${LAYOUT.sectionX} ${LAYOUT.sectionYCompact} bg-gradient-to-b from-[#f9fbfe] to-[#f4f8fc]`}
          aria-labelledby="news-title"
        >
          <div className={LAYOUT.container}>
            <SectionHeader title="お知らせ" id="news-title" align="left" className="mb-3">
              <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-[#00a1e9] hover:bg-[#e8f7ff]">
                <Link href="/news" aria-label="お知らせ一覧を見る">
                  一覧を見る
                </Link>
              </Button>
            </SectionHeader>

            <AnnouncementsStripMobile />
          </div>
        </section>

        {/* About */}
        <section
          id="about"
          className={`fade-in-start ${LAYOUT.sectionX} ${LAYOUT.sectionY}`}
          aria-labelledby="about-title"
        >
          <div className={LAYOUT.container}>
            <h2
              id="about-title"
              className="text-center font-bold mb-4 text-[clamp(1.4rem,6.4vw,1.8rem)]"
            >
              <span className="text-[#00a1e9] font-lilita">me-ish</span>
              <span className="ml-2 text-[#00a1e9]">とは</span>
            </h2>
            <p className="text-center text-[clamp(0.95rem,4.2vw,1.05rem)] leading-[1.8] text-[#333]">
              誰もが自分らしく作品を展示できる、オンラインギャラリー。作品の"見せ方"と"出会い方"をデザインし、
              アーティストと鑑賞者の距離を縮めます。
            </p>

            <div className="mt-6 grid gap-4">
              {[
                {
                  icon: Sparkles,
                  title: '作品が映える体験設計',
                  desc: '3D空間・ホログラム風ラベルなど、独自UIで鑑賞体験をアップデート。',
                },
                {
                  icon: Images,
                  title: '展示は簡単、応募はスムーズ',
                  desc: 'ガイド付き応募で迷わない。SOLDやエディション情報も自動で可視化。',
                },
                {
                  icon: ShieldCheck,
                  title: '画像保護ポリシー',
                  desc: 'ウォーターマークやAI認識阻害処理など、作品保護にも配慮（詳細はポリシー参照）。',
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className={`p-4 ${CARD.base}`}>
                  <div className="flex items-start gap-3">
                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#e8f7ff] to-[#d0efff] ring-1 ring-[#00a1e9]/10 shrink-0">
                      <Icon className="h-4 w-4 text-[#00a1e9]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#023]">{title}</p>
                      <p className="text-sm text-[#556] mt-1 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Gallery */}
        <section
          id="gallery"
          className={`fade-in-start ${LAYOUT.sectionY} px-6 bg-gradient-to-b from-[#f9fbfd] to-[#f4f8fc] text-center`}
          aria-labelledby="gallery-title"
        >
          <div className={LAYOUT.container}>
            <SectionHeader title="ギャラリーを見る" id="gallery-title" />

            <div className="grid gap-5 grid-cols-1">
              {[
                {
                  img: '/images/white-thumb.png',
                  title: 'White Gallery',
                  desc: '「意識の空間」をイメージした真っ白なギャラリー。10作品限定の特別展示。',
                  link: '/white',
                  link2d: '/white/2d',
                },
                {
                  img: '/images/float-thumb.jpg',
                  title: 'Float Gallery',
                  desc: '"漂う"ように入れ替わる美術館風ギャラリー。日替わりで多彩な作品を展示。',
                  link: '/float',
                  link2d: '/float/2d',
                },
              ].map(({ img, title, desc, link, link2d }) => (
                <div
                  key={title}
                  className={`group block text-left ${CARD.solid} hover:shadow-md transition-all duration-300`}
                >
                  <Link
                    href={link}
                    aria-label={`${title} へ`}
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a1e9] focus-visible:ring-offset-2 rounded-t-2xl"
                  >
                    <div className="overflow-hidden rounded-t-2xl">
                      <Image
                        src={img}
                        alt={`${title} thumbnail`}
                        width={960}
                        height={540}
                        sizes="100vw"
                        className="w-full h-auto object-cover transition-transform duration-500
                           group-hover:scale-105 motion-reduce:transition-none motion-reduce:transform-none"
                      />
                    </div>

                    <div className="p-4 pb-2">
                      <h3 className="text-base font-semibold text-[#023]">{title}</h3>
                      <p className="mt-1 text-[13px] text-[#556] line-clamp-2">{desc}</p>
                    </div>
                  </Link>

                  <div className="px-4 pb-4 flex items-center gap-3">
                    <Link
                      href={link}
                      className="inline-flex items-center gap-1 text-sm font-medium text-[#00a1e9] hover:underline"
                    >
                      3Dで見る <ArrowRight className="h-3 w-3" />
                    </Link>
                    <span className="text-gray-300">|</span>
                    <Link
                      href={link2d}
                      className="inline-flex items-center gap-1 text-sm font-medium text-[#667] hover:text-[#00a1e9] hover:underline"
                    >
                      2Dで見る <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 応募導線：全体クリック可能カード */}
        <section
          id="apply"
          className={`fade-in-start relative isolate overflow-hidden rounded-3xl
            bg-gradient-to-br from-[#dff6ff] via-white to-[#f0f9ff]
            mx-5 px-5 ${LAYOUT.sectionY} text-center
            ring-1 ring-[#00a1e9]/10 shadow-md
            ${CARD.interactive} group`}
          aria-labelledby="apply-title"
        >
          <Link href="/entry" className="absolute inset-0 z-10" aria-label="応募ページへ">
            <span className="sr-only">応募ページへ</span>
          </Link>

          <div className="relative z-20 max-w-md mx-auto pointer-events-none">
            <h2
              id="apply-title"
              className="text-[clamp(1.2rem,5.6vw,1.6rem)] font-bold text-[#00a1e9] leading-tight mb-2 group-hover:underline underline-offset-4"
            >
              あなたのアートを世界に届けよう
            </h2>
            <p className="text-[#556] text-[clamp(0.92rem,4.2vw,1rem)] mb-4">
              me-ishなら、スマホだけでもすぐに展示できます。
            </p>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#00a1e9] text-white text-sm font-semibold px-6 py-3 shadow-md group-hover:bg-[#008ed0] group-hover:shadow-lg transition-all duration-200">
              応募する <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </section>

        {/* Special Thanks（見出し自体をリンク化・中央配置） */}
        <section
          id="special-thanks-link"
          className={`fade-in-start ${LAYOUT.sectionY} px-6 bg-white`}
          aria-labelledby="thanks-link-title"
        >
          <div className={LAYOUT.container}>
            <div className={`p-8 flex flex-col items-center justify-center text-center ${CARD.base}`}>
              <h2 id="thanks-link-title" className="text-xl font-extrabold">
                <Link
                  href="/special-thanks"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 bg-clip-text text-transparent focus:outline-none focus:ring-2 focus:ring-[#00a1e9] focus:ring-offset-2 rounded-lg px-2 py-1 hover:opacity-80 transition-opacity"
                  aria-label="Special Thanks ページへ"
                  title="Special Thanks ページへ"
                >
                  <span>Special Thanks</span>
                </Link>
              </h2>

              <p className="mt-2 text-sm text-[#556]">me-ish初期ギャラリー(white)に応募してくださった皆さま</p>
            </div>
          </div>
        </section>

        {/* FAQ（shadcn Accordion） */}
        <section
          id="faq"
          className={`fade-in-start ${LAYOUT.sectionX} ${LAYOUT.sectionY} bg-gradient-to-b from-[#f6f8fb] to-[#f0f4f8]`}
          aria-labelledby="faq-title"
        >
          <div className={LAYOUT.container}>
            <SectionHeader title="よくある質問" id="faq-title" />

            <Accordion type="single" collapsible className="space-y-3">
              {[
                {
                  value: 'q1',
                  q: 'Q. 誰でも出展できますか？',
                  a: (
                    <>
                      A. はい、プロ・アマ問わずご応募いただけます。展示は<strong>審査制</strong>です。
                    </>
                  ),
                },
                {
                  value: 'q2',
                  q: 'Q. 出展に料金はかかりますか？',
                  a: (
                    <>
                      A. <strong>応募・展示は無料</strong>です。作品が売れた場合のみ、売上から<strong>手数料</strong>
                      をいただきます。詳細はFAQをご確認ください。有料プランでは「最低表示回数保証」が付きます。
                    </>
                  ),
                },
                {
                  value: 'q3',
                  q: 'Q. 生成AIは使ってもいいですか？',
                  a: (
                    <>
                      A. <strong>AIだけで作った"完全生成"の作品は不可</strong>です。一方で、ラフ作成や構図検討などの
                      <strong>補助的な利用</strong>はケースにより扱いが異なります。詳細はFAQをご確認ください。
                    </>
                  ),
                },
              ].map(({ value, q, a }) => (
                <AccordionItem
                  key={value}
                  value={value}
                  className={`px-4 ${CARD.base}`}
                >
                  <AccordionTrigger className="text-left font-semibold text-[#023] py-3">
                    {q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-[#445] pb-4">
                    {a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <div className="pt-5 text-center">
              <Button
                asChild
                variant="outline"
                className="rounded-full border-[#00a1e9] text-[#00a1e9] hover:bg-[#e8f7ff] hover:text-[#00a1e9]"
              >
                <Link href="/footer/faq" aria-label="よくある質問をもっと見る">
                  もっと見る <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section
          id="contact"
          className={`fade-in-start ${LAYOUT.sectionX} ${LAYOUT.sectionY} bg-white text-center`}
          aria-labelledby="contact-title"
        >
          <div className={LAYOUT.container}>
            <SectionHeader
              title="お問い合わせ"
              id="contact-title"
              subtitle="ご質問・ご相談などございましたら、以下よりご連絡ください。"
            />

            <ul className="mt-2 text-[#00a1e9] text-sm space-y-3 max-w-[420px] mx-auto">
              <li className="flex items-center justify-center gap-2">
                <Mail className="w-4 h-4" />
                <Link
                  href="/contact"
                  className="underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a1e9]/20 rounded transition-colors"
                  aria-label="お問い合わせフォームへ"
                >
                  お問い合わせフォームへ
                </Link>
              </li>
              <li className="flex items-center justify-center gap-2">
                <FaXTwitter className="w-4 h-4" />
                <a
                  href="https://x.com/meishart0716"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a1e9]/20 rounded transition-colors"
                  aria-label="me-ish公式X（旧Twitter）を開く"
                >
                  X（旧Twitter）
                </a>
              </li>
            </ul>
          </div>
        </section>
      </main>

      {/* フェードアニメーション（reduced-motion対応） */}
      <style jsx>{`
        .fade-in-start {
          opacity: 0;
          transform: translate3d(0, 12px, 0);
          transition: opacity 500ms cubic-bezier(0.4, 0, 0.2, 1),
                      transform 500ms cubic-bezier(0.4, 0, 0.2, 1);
          will-change: opacity, transform;
        }
        .fade-in-start.show {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
        @media (prefers-reduced-motion: reduce) {
          .fade-in-start {
            opacity: 1;
            transform: none;
            transition: none;
            will-change: auto;
          }
          .fade-in-start.show {
            transform: none;
          }
        }
      `}</style>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────
   お知らせ表示（モバイル用コンパクト / shadcn Card+Badge）
────────────────────────────────────────────────────────────── */
function AnnouncementsStripMobile() {
  const { items, loading } = useAnnouncements(3);

  const fmt = React.useMemo(
    () => new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }),
    []
  );

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        {[0, 1, 2].map((i) => (
          <Card key={i} className={CARD.base}>
            <CardContent className="py-3">
              <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200/70" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <Card className={CARD.base}>
        <CardContent className="py-4 text-xs text-[#667]">現在お知らせはありません。</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {(items as any[]).map((n: any) => (
        <Card key={n.id} className={CARD.base}>
          <CardContent className="py-3">
            <Link
              href="/news"
              className="flex items-center gap-2 overflow-hidden rounded-xl focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-[#00a1e9]/20"
              aria-label={`お知らせを見る: ${n.title}`}
            >
              <AnnouncementBadge type={n.category as 'info' | 'update' | 'maintenance'} />

              {n.pinned && (
                <Badge variant="secondary" className="bg-rose-100 text-rose-700 hover:bg-rose-100">
                  固定
                </Badge>
              )}

              <time
                className="shrink-0 text-[11px] text-gray-500 tabular-nums"
                dateTime={new Date(n.published_at).toISOString()}
              >
                {fmt.format(new Date(n.published_at))}
              </time>

              <span className="mx-1 text-gray-300" aria-hidden="true">
                ·
              </span>

              <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#023]" title={n.title}>
                {n.title}
              </span>
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AnnouncementBadge({ type }: { type: 'info' | 'update' | 'maintenance' }) {
  const label: Record<string, string> = {
    info: 'Info',
    update: 'Update',
    maintenance: 'Maintenance',
  };

  const cls: Record<string, string> = {
    info: 'border-[#bcdfff]/60 bg-[#e8f4ff] text-[#005a9e]',
    update: 'border-emerald-200 bg-[#eafbea] text-emerald-700',
    maintenance: 'border-rose-200 bg-[#fff1f0] text-rose-700',
  };

  return (
    <Badge variant="outline" className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${cls[type]}`}>
      {label[type]}
    </Badge>
  );
}

export default MobileHome;
