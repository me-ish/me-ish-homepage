'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
// import Header from '@/components/shared/Header'; // ← 削除
import { Mail, ArrowRight, ShieldCheck, Images, Sparkles } from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';
import { useAnnouncements } from '@/hooks/useAnnouncements';

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
        <section
          className="relative fade-in-start px-5 py-14 text-center"
          aria-labelledby="hero-title"
        >
          {/* やわらかグラデ背景 */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,161,233,0.12),_transparent_60%),radial-gradient(ellipse_at_bottom,_rgba(0,161,233,0.06),_transparent_60%)]" />
          </div>

          <h1
            id="hero-title"
            className="font-lilita font-bold leading-none text-[#00a1e9] tracking-tight
                       text-[clamp(2.4rem,12vw,3.4rem)]"
          >
            me-ish
          </h1>
          <p className="text-[#00a1e9]/80 uppercase tracking-[0.22em] mt-1 text-[clamp(0.8rem,3.2vw,1rem)]">
            — online gallery —
          </p>

          <p className="mt-6 text-[clamp(1.05rem,5vw,1.4rem)]">
            アートを、もっと近くに
          </p>

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
        <section
          id="news"
          className="fade-in-start px-5 py-8 bg-[#f9fbfe]"
          aria-labelledby="news-title"
        >
          <div className="max-w-[680px] mx-auto">
            <div className="flex items-baseline justify-between mb-3">
              <h2 id="news-title" className="text-base font-bold text-[#00a1e9]">お知らせ</h2>
              <Link
                href="/news"
                className="text-xs text-[#00a1e9] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a1e9]/20 rounded"
                aria-label="お知らせ一覧を見る"
              >
                一覧を見る
              </Link>
            </div>
            <AnnouncementsStripMobile />
          </div>
        </section>

        {/* About */}
        <section id="about" className="fade-in-start px-5 py-10" aria-labelledby="about-title">
          <h2 id="about-title" className="text-center font-bold mb-4 text-[clamp(1.4rem,6.4vw,1.8rem)]">
            <span className="text-[#00a1e9] font-lilita">me-ish</span>
            <span className="ml-2 text-[#00a1e9]">とは</span>
          </h2>
          <p className="text-center text-[clamp(0.95rem,4.2vw,1.05rem)] leading-[1.8] text-[#333]">
            誰もが自分らしく作品を展示できる、オンラインギャラリー。
            作品の“見せ方”と“出会い方”をデザインし、アーティストと鑑賞者の距離を縮めます。
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
        <section id="gallery" className="fade-in-start px-5 py-10 bg-[#f9fbfd]" aria-labelledby="gallery-title">
          <h2 id="gallery-title" className="text-center font-bold text-[#00a1e9] mb-6 text-[clamp(1.3rem,6vw,1.7rem)]">
            ギャラリーを見る
          </h2>

          <div className="grid gap-6 max-w-[640px] mx-auto">
            {[
              {
                img: '/images/white-thumb.jpg',
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
                href={link}
                key={title}
                className="group block overflow-hidden rounded-2xl bg-white border shadow-sm active:scale-[0.995] transition"
                aria-label={`${title}へ`}
              >
                <div className="relative aspect-[16/9]">
                  <Image
                    src={img}
                    alt={title}
                    fill
                    sizes="100vw"
                    className="object-cover transition-transform duration-500 group-active:scale-[0.99]"
                    priority={false}
                  />
                </div>
                <div className="p-4 text-left">
                  <h3 className="text-[1.02rem] font-semibold text-[#00a1e9]">{title}</h3>
                  <p className="mt-1 text-sm text-[#445] leading-relaxed">{desc}</p>
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
          {/* 子要素必須 → sr-only を入れる */}
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

        {/* FAQ */}
        <section id="faq" className="fade-in-start px-5 py-10 bg-[#f6f8fb]" aria-labelledby="faq-title">
          <h2 id="faq-title" className="text-center font-bold text-[#00a1e9] mb-5 text-[clamp(1.2rem,5.6vw,1.6rem)]">
            よくある質問
          </h2>

          <div className="max-w-[640px] mx-auto space-y-3">
            <details className="rounded-xl bg-white/80 border p-4">
              <summary className="font-semibold cursor-pointer">Q. 誰でも出展できますか？</summary>
              <p className="mt-2 text-sm leading-relaxed">A. はい、プロ・アマ問わずどなたでもご応募いただけます。</p>
            </details>
            <details className="rounded-xl bg-white/80 border p-4">
              <summary className="font-semibold cursor-pointer">Q. 出展に料金はかかりますか？</summary>
              <p className="mt-2 text-sm leading-relaxed">
                A. 基本の展示は無料です。作品が売れた場合は<strong>手数料</strong>をいただきます（詳細はFAQをご確認ください）。
                有料プランでは「最低表示回数保証」が付きます。
              </p>
            </details>
            <details className="rounded-xl bg-white/80 border p-4">
              <summary className="font-semibold cursor-pointer">Q. NFTの販売は可能ですか？</summary>
              <p className="mt-2 text-sm leading-relaxed">
                A. はい、NFT販売にも対応しており、<strong>円での購入</strong>も可能です。
              </p>
            </details>

            <div className="pt-2">
              <Link
                href="/footer/faq"
                className="inline-flex items-center gap-2 rounded-full border border-[#00a1e9] px-4 py-2 text-[#00a1e9] font-semibold active:scale-[0.99] transition
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a1e9]/20"
                aria-label="よくある質問をもっと見る"
              >
                もっと見る <ArrowRight className="h-4 w-4" />
              </Link>
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
                href="/contact/form"
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
        .fade-in-start { opacity: 0; transform: translateY(10px); transition: opacity 600ms ease, transform 600ms ease; }
        .fade-in-start.show { opacity: 1; transform: translateY(0); }
        @media (prefers-reduced-motion: reduce) {
          .fade-in-start { transition: none !important; }
        }
      `}</style>
    </div>
  );
};

/* ---- お知らせ表示（モバイル用コンパクト） ---- */
function AnnouncementsStripMobile() {
  const { items, loading } = useAnnouncements(3);

  if (loading) {
    return (
      <ul className="space-y-3" aria-busy="true" aria-live="polite">
        {[0, 1, 2].map((i) => (
          <li key={i} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="h-3.5 w-20 bg-gray-200/70 rounded animate-pulse mb-2" />
            <div className="h-4 w-3/4 bg-gray-200/80 rounded animate-pulse mb-2" />
            <div className="h-3.5 w-full bg-gray-200/60 rounded animate-pulse" />
          </li>
        ))}
      </ul>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-xl border bg-white p-4 text-xs text-[#667]">
        現在お知らせはありません。
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((n) => (
        <li key={n.id} className="rounded-xl border bg-white p-4 shadow-sm active:scale-[0.995] transition">
          <div className="flex items-center gap-2">
            <Badge type={n.category} />
            {n.pinned && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">固定</span>}
            <time className="ml-auto text-[11px] text-gray-500">
              {new Date(n.published_at).toLocaleDateString()}
            </time>
          </div>
          <p className="mt-1 font-semibold leading-snug line-clamp-2">{n.title}</p>
          <p className="mt-0.5 text-xs text-[#556] leading-relaxed line-clamp-2">{n.body_md.replace(/\n/g, ' ')}</p>
          <Link
            href="/news"
            className="mt-1.5 inline-block text-xs text-[#00a1e9] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a1e9]/20 rounded"
          >
            詳細・一覧へ
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Badge({ type }: { type: 'info' | 'update' | 'maintenance' }) {
  const styles: Record<string, string> = {
    info: 'bg-[#e8f4ff] text-[#005a9e]',
    update: 'bg-[#eafbea] text-[#1b6e2b]',
    maintenance: 'bg-[#fff1f0] text-[#a23a3a]',
  };
  const label: Record<string, string> = {
    info: 'Info',
    update: 'Update',
    maintenance: 'Maintenance',
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded ${styles[type]}`}>{label[type]}</span>;
}

export default MobileHome;

