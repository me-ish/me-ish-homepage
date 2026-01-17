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

/* スクロール時のフェードイン */
function useFadeInOnScroll() {
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>('.fade-in-start');
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('show');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 }
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);
}

const MobileHome = () => {
  useFadeInOnScroll();

  return (
    <div className="font-zen text-[#222] bg-white">
      {/* Header は layout.tsx 側に任せる */}

      {/* ヘッダー分の余白（モバイルはやや低め） */}
      <main className="pt-[64px]">
        {/* Hero：1アクション集中（応募） */}
        <section className="relative fade-in-start px-5 py-14 text-center" aria-labelledby="hero-title">
          {/* やわらかグラデ背景（↑余白ぶんもカバー） */}
          <div className="pointer-events-none absolute inset-x-0 -z-10 top-[-64px] h-[calc(100%+64px)]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,161,233,0.12),_transparent_60%),radial-gradient(ellipse_at_bottom,_rgba(0,161,233,0.06),_transparent_60%)]" />
          </div>

          <h1
            id="hero-title"
            className="font-lilita font-bold leading-none text-[#00a1e9] tracking-tight text-[clamp(2.4rem,12vw,3.4rem)]"
          >
            me-ish
          </h1>
          <p className="text-[#00a1e9]/80 uppercase tracking-[0.22em] mt-1 text-[clamp(0.8rem,3.2vw,1rem)]">
            — online gallery —
          </p>

          <p className="mt-6 text-[clamp(1.05rem,5vw,1.4rem)]">アートを、もっと近くに</p>

          {/* 主CTAのみを強調 */}
          <div className="mt-7">
            <Link
              href="/entry"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#00a1e9]
                         px-6 py-3 text-white font-semibold shadow active:scale-[0.99] transition
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a1e9]/30"
              aria-label="応募する"
            >
              応募する <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* サブ導線 */}
          <div className="mt-4">
            <Link
              href="#gallery"
              className="text-[#00a1e9] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a1e9]/20 rounded"
            >
              まずはギャラリーを見る
            </Link>
          </div>
        </section>

        {/* お知らせ */}
        <section id="news" className="fade-in-start px-5 py-8 bg-[#f9fbfe]" aria-labelledby="news-title">
          <div className="max-w-[680px] mx-auto">
            <div className="flex items-baseline justify-between mb-3">
              <h2 id="news-title" className="text-base font-bold text-[#00a1e9]">
                お知らせ
              </h2>

              <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-[#00a1e9] hover:bg-[#e8f7ff]">
                <Link href="/news" aria-label="お知らせ一覧を見る">
                  一覧を見る
                </Link>
              </Button>
            </div>

            <AnnouncementsStripMobile />
          </div>
        </section>

        {/* About */}
        <section id="about" className="fade-in-start px-5 py-10" aria-labelledby="about-title">
          <h2
            id="about-title"
            className="text-center font-bold mb-4 text-[clamp(1.4rem,6.4vw,1.8rem)]"
          >
            <span className="text-[#00a1e9] font-lilita">me-ish</span>
            <span className="ml-2 text-[#00a1e9]">とは</span>
          </h2>
          <p className="text-center text-[clamp(0.95rem,4.2vw,1.05rem)] leading-[1.8] text-[#333]">
            誰もが自分らしく作品を展示できる、オンラインギャラリー。作品の“見せ方”と“出会い方”をデザインし、
            アーティストと鑑賞者の距離を縮めます。
          </p>

          <div className="mt-6 grid gap-4">
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-[#00a1e9] shrink-0" />
                <div>
                  <p className="font-semibold">作品が映える体験設計</p>
                  <p className="text-sm text-[#555] mt-1">
                    3D空間・ホログラム風ラベルなど、独自UIで鑑賞体験をアップデート。
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <Images className="h-5 w-5 text-[#00a1e9] shrink-0" />
                <div>
                  <p className="font-semibold">展示は簡単、応募はスムーズ</p>
                  <p className="text-sm text-[#555] mt-1">
                    ガイド付き応募で迷わない。SOLDやエディション情報も自動で可視化。
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-[#00a1e9] shrink-0" />
                <div>
                  <p className="font-semibold">画像保護ポリシー</p>
                  <p className="text-sm text-[#555] mt-1">
                    ウォーターマークやAI認識阻害処理など、作品保護にも配慮（詳細はポリシー参照）。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Gallery */}
        <section
          id="gallery"
          className="fade-in-start py-16 px-6 bg-[#f9fbfd] text-center"
          aria-labelledby="gallery-title"
        >
          <h2
            id="gallery-title"
            className="font-bold text-[clamp(1.6rem,3.4vw,2.2rem)] text-[#00a1e9] mb-8"
          >
            ギャラリーを見る
          </h2>

          <div className="grid gap-6 sm:gap-8 grid-cols-1 sm:grid-cols-2 max-w-[1040px] mx-auto">
            {[
              {
                img: '/images/white-thumb.png',
                title: 'White Gallery',
                desc: '「意識の空間」をイメージした真っ白なギャラリー。10作品限定の特別展示。',
                link: '/white',
              },
              {
                img: '/images/float-thumb.jpg',
                title: 'Float Gallery',
                desc: '“漂う”ように入れ替わる美術館風ギャラリー。日替わりで多彩な作品を展示。',
                link: '/float',
              },
            ].map(({ img, title, desc, link }) => (
              <Link
                key={title}
                href={link}
                aria-label={`${title} へ`}
                className="group block text-left rounded-2xl bg-white shadow-sm ring-1 ring-gray-100
                   hover:shadow-md transition focus-visible:outline-none
                   focus-visible:ring-2 focus-visible:ring-[#00a1e9] focus-visible:ring-offset-2"
              >
                <div className="overflow-hidden rounded-2xl">
                  <Image
                    src={img}
                    alt={`${title} thumbnail`}
                    width={960}
                    height={540}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="w-full h-auto object-cover transition-transform duration-300
                       group-hover:scale-105 motion-reduce:transition-none motion-reduce:transform-none"
                  />
                </div>

                <div className="p-4 sm:p-5">
                  <h3 className="text-base sm:text-lg font-semibold">{title}</h3>
                  <p className="mt-1 text-[13px] sm:text-sm text-[#445] line-clamp-2">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 応募導線：全体クリック可能カード */}
        <section
          id="apply"
          className="fade-in-start relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-[#dff6ff] via-white to-[#f0f9ff]
                     mx-5 px-5 py-10 text-center shadow-md active:scale-[0.995] transition"
          aria-labelledby="apply-title"
        >
          <Link href="/entry" className="absolute inset-0 z-10" aria-label="応募ページへ">
            <span className="sr-only">応募ページへ</span>
          </Link>

          <div className="relative z-20 max-w-md mx-auto pointer-events-none">
            <h2 id="apply-title" className="text-[clamp(1.2rem,5.6vw,1.6rem)] font-bold text-[#00a1e9] leading-tight mb-2">
              あなたのアートを世界に届けよう
            </h2>
            <p className="text-gray-600 text-[clamp(0.92rem,4.2vw,1rem)] mb-4">
              me-ishなら、スマホだけでもすぐに展示できます。
            </p>
            <div className="inline-block rounded-full bg-[#00a1e9] text-white text-sm font-semibold px-6 py-3 shadow">
              応募する
            </div>
          </div>
        </section>

        {/* Special Thanks（見出し自体をリンク化・中央配置） */}
        <section id="special-thanks-link" className="fade-in-start py-10 px-6 bg-white" aria-labelledby="thanks-link-title">
          <div className="max-w-[1040px] mx-auto">
            <div className="rounded-2xl border bg-white p-10 shadow-sm flex flex-col items-center justify-center text-center">
              <h2 id="thanks-link-title" className="text-2xl font-extrabold">
                <Link
                  href="/special-thanks"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 bg-clip-text text-transparent focus:outline-none focus:ring-2 focus:ring-[#00a1e9] focus:ring-offset-2 rounded-lg px-2 py-1"
                  aria-label="Special Thanks ページへ"
                  title="Special Thanks ページへ"
                >
                  <span>✨ Special Thanks ✨</span>
                </Link>
              </h2>

              <p className="mt-2 text-sm text-[#445]">me-ish初期ギャラリー(white)に応募してくださった皆さま</p>
            </div>
          </div>
        </section>

        {/* FAQ（shadcn Accordion） */}
        <section id="faq" className="fade-in-start px-5 py-10 bg-[#f6f8fb]" aria-labelledby="faq-title">
          <h2 id="faq-title" className="text-center font-bold text-[#00a1e9] mb-5 text-[clamp(1.2rem,5.6vw,1.6rem)]">
            よくある質問
          </h2>

          <div className="max-w-[640px] mx-auto">
            <Accordion type="single" collapsible className="space-y-3">
              <AccordionItem value="q1" className="rounded-xl border bg-white/80 px-4">
                <AccordionTrigger className="text-left font-semibold">
                  Q. 誰でも出展できますか？
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed">
                  A. はい、プロ・アマ問わずご応募いただけます。展示は<strong>審査制</strong>です。
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="q2" className="rounded-xl border bg-white/80 px-4">
                <AccordionTrigger className="text-left font-semibold">
                  Q. 出展に料金はかかりますか？
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed">
                  A. <strong>応募・展示は無料</strong>です。作品が売れた場合のみ、売上から<strong>手数料</strong>をいただきます。
                  詳細はFAQをご確認ください。有料プランでは「最低表示回数保証」が付きます。
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="q3" className="rounded-xl border bg-white/80 px-4">
                <AccordionTrigger className="text-left font-semibold">
                  Q. 生成AIは使ってもいいですか？
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed">
                  A. <strong>AIだけで作った“完全生成”の作品は不可</strong>です。一方で、ラフ作成や構図検討などの
                  <strong>補助的な利用</strong>はケースにより扱いが異なります。詳細はFAQをご確認ください。
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="pt-3">
              <Button
                asChild
                variant="outline"
                className="rounded-full border-[#00a1e9] text-[#00a1e9] hover:bg-[#e8f7ff]"
              >
                <Link href="/footer/faq" aria-label="よくある質問をもっと見る">
                  もっと見る <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="fade-in-start px-5 py-10 bg-white text-center" aria-labelledby="contact-title">
          <h2 id="contact-title" className="font-bold text-[#00a1e9] mb-3 text-[clamp(1.2rem,5.6vw,1.6rem)]">
            お問い合わせ
          </h2>
          <p className="mb-5 text-[0.95rem]">ご質問・ご相談などございましたら、以下よりご連絡ください。</p>

          <ul className="text-[#00a1e9] text-sm space-y-3 max-w-[420px] mx-auto">
            <li className="flex items-center justify-center gap-2">
              <Mail className="w-4 h-4" />
              <Link
                href="/contact"
                className="underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a1e9]/20 rounded"
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
                className="underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a1e9]/20 rounded"
                aria-label="me-ish公式X（旧Twitter）を開く"
              >
                X（旧Twitter）
              </a>
            </li>
          </ul>
        </section>
      </main>

      {/* フェード定義（Tailwindと併用） */}
      <style jsx>{`
        .fade-in-start {
          opacity: 0;
          transform: translateY(10px);
          transition: opacity 600ms ease, transform 600ms ease;
        }
        .fade-in-start.show {
          opacity: 1;
          transform: translateY(0);
        }
        @media (prefers-reduced-motion: reduce) {
          .fade-in-start {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
};

/* ---- お知らせ表示（モバイル用コンパクト / shadcn Card+Badge） ---- */
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
          <Card key={i} className="rounded-2xl">
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
      <Card className="rounded-2xl">
        <CardContent className="py-4 text-xs text-muted-foreground">現在お知らせはありません。</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {(items as any[]).map((n: any) => (
        <Card key={n.id} className="rounded-2xl">
          <CardContent className="py-3">
            {/* ひとまず一覧へ。個別ページがあるなら n.link_url 等に差し替え可 */}
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
                className="shrink-0 text-[11px] text-muted-foreground tabular-nums"
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
    info: 'bg-[#e8f4ff] text-[#005a9e] hover:bg-[#e8f4ff]',
    update: 'bg-[#eafbea] text-emerald-700 hover:bg-[#eafbea]',
    maintenance: 'bg-[#fff1f0] text-rose-700 hover:bg-[#fff1f0]',
  };

  return (
    <Badge variant="secondary" className={`text-[10px] ${cls[type]}`}>
      {label[type]}
    </Badge>
  );
}

export default MobileHome;
