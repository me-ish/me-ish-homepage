'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/shared/Header';
import { Mail, Sparkles, ShieldCheck, Images, ArrowRight, ExternalLink } from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';

// スクロール時のフェードイン処理
function useFadeInOnScroll() {
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>('.fade-in-start');
    const callback: IntersectionObserverCallback = (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('show');
          observer.unobserve(entry.target); // 一度だけ
        }
      });
    };
    const observer = new IntersectionObserver(callback, { threshold: 0.2 });
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);
}

const DesktopHome = () => {
  useFadeInOnScroll();

  return (
    <div className="font-zen text-[#222] bg-white">
      <Header />

      {/* ヘッダー固定分の余白 */}
      <main className="pt-[70px]">

        {/* Hero */}
        <section
          className="relative flex flex-col items-center justify-center min-h-[82vh] text-center px-6 fade-in-start"
          aria-labelledby="hero-title"
        >
          {/* 背景グラデ & ノイズ */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,161,233,0.10),_transparent_60%),radial-gradient(ellipse_at_bottom,_rgba(0,161,233,0.06),_transparent_60%)]" />
          </div>

          <h1
            id="hero-title"
            className="font-lilita font-bold leading-none text-[#00a1e9]
                       text-[clamp(2.8rem,8vw,5rem)] tracking-tight"
          >
            me-ish
          </h1>
          <p className="text-[#00a1e9]/80 uppercase tracking-[0.22em] mt-2 text-[clamp(0.85rem,1.6vw,1.1rem)]">
            — online gallery —
          </p>

          <p className="mt-8 text-[clamp(1.1rem,2.6vw,1.8rem)] tracking-wide">
            アートを、もっと近くに
          </p>

          {/* CTA */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="#gallery"
              className="inline-flex items-center gap-2 rounded-full bg-[#00a1e9] px-6 py-3 text-white font-semibold shadow hover:shadow-lg hover:-translate-y-0.5 transition"
              aria-label="ギャラリーを見る"
            >
              ギャラリーを見る <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/entry"
              className="inline-flex items-center gap-2 rounded-full border border-[#00a1e9] px-6 py-3 text-[#00a1e9] font-semibold hover:bg-[#e8f7ff] transition"
              aria-label="応募する"
            >
              応募する <ExternalLink className="h-4 w-4" />
            </Link>
          </div>

          {/* 下スクロール誘導 */}
          <a href="#about" className="mt-10 text-sm text-[#00a1e9]/70 hover:text-[#00a1e9] transition">
            もっと見る
          </a>
        </section>

        {/* About */}
        <section id="about" className="fade-in-start py-16 px-6 bg-white" aria-labelledby="about-title">
          <div className="max-w-[1000px] mx-auto">
            <h2 id="about-title" className="text-center font-bold mb-10">
              <span className="block text-[clamp(1.8rem,3.8vw,2.6rem)]">
                <span className="text-[#00a1e9] font-lilita">me-ish</span>
                <span className="ml-2 text-[#00a1e9]">とは</span>
              </span>
            </h2>

            <p className="max-w-[820px] mx-auto text-[clamp(1rem,1.6vw,1.15rem)] leading-[1.9] text-center text-[#333]">
              me-ish（ミーイッシュ）は、誰もが自分らしく作品を展示できるオンラインギャラリー。
              作品の“見せ方”と“出会い方”をデザインし、アーティストと鑑賞者の距離を縮めます。
            </p>

            {/* 3つの価値 */}
            <div className="mt-12 grid gap-6 grid-cols-1 md:grid-cols-3">
              <div className="rounded-2xl border bg-white p-6 shadow-sm hover:shadow-md transition">
                <Sparkles className="h-6 w-6 text-[#00a1e9]" />
                <h3 className="mt-3 font-semibold">作品が映える体験設計</h3>
                <p className="mt-2 text-sm text-[#555] leading-relaxed">
                  3D空間・ホログラム風ラベルなど、me-ish独自のUIで鑑賞体験をアップデート。
                </p>
              </div>
              <div className="rounded-2xl border bg-white p-6 shadow-sm hover:shadow-md transition">
                <Images className="h-6 w-6 text-[#00a1e9]" />
                <h3 className="mt-3 font-semibold">展示は簡単、応募はスムーズ</h3>
                <p className="mt-2 text-sm text-[#555] leading-relaxed">
                  ガイド付き応募フローで、はじめてでも迷わない。展示後はSOLDやエディション情報も自動で可視化。
                </p>
              </div>
              <div className="rounded-2xl border bg-white p-6 shadow-sm hover:shadow-md transition">
                <ShieldCheck className="h-6 w-6 text-[#00a1e9]" />
                <h3 className="mt-3 font-semibold">画像保護ポリシー</h3>
                <p className="mt-2 text-sm text-[#555] leading-relaxed">
                  ウォーターマークやAI認識阻害処理など、作品保護にも配慮（詳細はポリシーをご確認ください）。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Gallery */}
        <section id="gallery" className="fade-in-start py-16 px-6 bg-[#f9fbfd] text-center" aria-labelledby="gallery-title">
          <h2 id="gallery-title" className="font-bold text-[clamp(1.6rem,3.4vw,2.2rem)] text-[#00a1e9] mb-8">
            ギャラリーを見る
          </h2>

          <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 max-w-[1040px] mx-auto">
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
                className="group block overflow-hidden rounded-2xl bg-white border shadow-sm hover:shadow-lg hover:-translate-y-1 transition"
                aria-label={`${title}へ`}
              >
                <div className="relative aspect-[16/9]">
                  <Image
                    src={img}
                    alt={title}
                    fill
                    sizes="(max-width: 768px) 100vw, 520px"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    priority={false}
                  />
                </div>
                <div className="p-5 text-left">
                  <h3 className="text-[1.05rem] font-semibold text-[#00a1e9]">{title}</h3>
                  <p className="mt-1 text-sm text-[#445] leading-relaxed">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 応募導線 */}
        <section
          id="apply"
          className="fade-in-start relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-[#dff6ff] via-white to-[#f0f9ff] px-6 py-20 text-center shadow-md transition hover:shadow-xl hover:scale-[1.01] group mx-6 md:mx-auto md:max-w-[1040px]"
          aria-labelledby="apply-title"
        >
          <Link href="/entry" className="absolute inset-0 z-10" aria-label="応募ページへ" />

          <div className="relative z-20 max-w-xl mx-auto pointer-events-none">
            <h2 id="apply-title" className="text-[clamp(1.5rem,3.2vw,2.2rem)] font-bold text-[#00a1e9] leading-tight mb-3 group-hover:underline underline-offset-4">
              あなたのアートを<br />世界に届けよう
            </h2>
            <p className="text-gray-600 text-[clamp(0.95rem,1.6vw,1.05rem)] mb-6">
              me-ishでは、どなたでも気軽に作品を展示できます。
            </p>
            <div className="inline-block rounded-full bg-[#00a1e9] text-white text-sm sm:text-base font-semibold px-6 py-3 shadow group-hover:bg-[#008ed0] transition">
              応募する
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="fade-in-start py-16 px-6 bg-[#f6f8fb]" aria-labelledby="faq-title">
          <h2 id="faq-title" className="text-center font-bold text-[clamp(1.6rem,3.2vw,2.1rem)] text-[#00a1e9] mb-6">
            よくある質問
          </h2>

          <ul className="max-w-[880px] mx-auto space-y-6 text-[0.96rem] text-[#444]">
            <li className="rounded-xl bg-white/70 border p-5">
              <p className="font-semibold text-[#333]">Q. 誰でも出展できますか？</p>
              <p className="mt-1 leading-relaxed">A. はい、プロ・アマ問わずどなたでもご応募いただけます。</p>
            </li>
            <li className="rounded-xl bg-white/70 border p-5">
              <p className="font-semibold text-[#333]">Q. 出展に料金はかかりますか？</p>
              <p className="mt-1 leading-relaxed">
                A. 基本の展示は無料です。作品が売れた場合は<strong>手数料</strong>をいただきます（詳細はFAQをご確認ください）。
                また、有料プランでは「最低表示回数保証」が付与されます。
              </p>
            </li>
            <li className="rounded-xl bg-white/70 border p-5">
              <p className="font-semibold text-[#333]">Q. NFTの販売は可能ですか？</p>
              <p className="mt-1 leading-relaxed">
                A. はい、NFT販売にも対応しており、<strong>円での購入</strong>も可能です。
              </p>
            </li>
          </ul>

          <div className="mt-8 text-center">
            <Link
              href="/footer/faq"
              className="inline-flex items-center gap-2 rounded-full border border-[#00a1e9] px-5 py-2.5 text-[#00a1e9] font-semibold hover:bg-[#e8f7ff] transition"
              aria-label="よくある質問をもっと見る"
            >
              よくある質問をもっと見る
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="fade-in-start py-16 px-6 bg-white text-center" aria-labelledby="contact-title">
          <h2 id="contact-title" className="font-bold text-[clamp(1.5rem,3vw,2rem)] text-[#00a1e9] mb-4">
            お問い合わせ
          </h2>
          <p className="mb-6 text-[0.98rem]">ご質問・ご相談などございましたら、以下よりご連絡ください。</p>

          <ul className="mt-6 text-[#00a1e9] text-sm space-y-3 max-w-xs mx-auto">
            <li className="flex items-center justify-center gap-2">
              <Mail className="w-4 h-4" />
              <Link href="/contact/form" className="hover:underline" aria-label="お問い合わせフォームへ">
                お問い合わせフォームへ
              </Link>
            </li>
            <li className="flex items-center justify-center gap-2">
              <FaXTwitter className="w-4 h-4" />
              <a
                href="https://x.com/meishart0716"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                aria-label="me-ish公式X（旧Twitter）を開く"
              >
                X（旧Twitter）
              </a>
            </li>
          </ul>
        </section>
      </main>

      {/* フェード用の最小スタイル（Tailwindと併用） */}
      <style jsx>{`
        .fade-in-start {
          opacity: 0;
          transform: translateY(12px);
          transition: opacity 700ms ease, transform 700ms ease;
        }
        .fade-in-start.show {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
};

export default DesktopHome;
