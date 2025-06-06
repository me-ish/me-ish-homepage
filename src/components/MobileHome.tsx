'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/shared/Header';

// アニメーション用フック
function useFadeInOnScroll() {
  useEffect(() => {
    const targets = document.querySelectorAll('.fade-in-start');

    const callback: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('show');
        }
      });
    };

    const observer = new IntersectionObserver(callback, {
      threshold: 0.2,
    });

    targets.forEach((target) => {
      observer.observe(target);
    });

    return () => observer.disconnect();
  }, []);
}

const MobileHome = () => {
  useFadeInOnScroll();

  return (
    <div className="font-zen text-[#333] bg-white">
      <Header />

      {/* Heroセクション */}
      <section className="fade-in-start flex flex-col items-center justify-center h-screen text-center px-5">
        <h1 className="font-lilita text-[4.5rem] text-[#00a1e9] font-bold m-0">
          me-ish
        </h1>
        <p className="text-[1.2rem] text-[#00a1e9] mt-[-20px] tracking-widest uppercase">
          - online gallery -
        </p>
        <p className="text-[1.8rem] text-[#333] mt-12 tracking-wider">
          アートを、もっと近くに
        </p>
      </section>

      {/* Aboutセクション */}
      <section id="about" className="fade-in-start py-[60px] px-5 bg-white text-[#333]">
        <div className="max-w-[800px] mx-auto text-[1.1rem] leading-[1.8]">
          <h2 className="text-[2.5rem] font-bold mb-8 text-center">
            <span className="text-[#00a1e9] font-lilita">me-ish</span>
            <span className="text-[#00a1e9] font-bold">とは</span>
          </h2>
          <p className="mb-5">
            me-ish は、知名度やキャリアを問わず、すべてのアーティストが自由に作品を展示・販売できるオンラインギャラリーです。NFTと通常販売の両方に対応しており、アートをもっと身近に楽しめる場所を目指しています。
          </p>
        </div>
      </section>

      {/* Galleryセクション */}
      <section id="gallery" className="fade-in-start py-[60px] px-5 bg-[#f9f9f9] text-center">
        <h2 className="text-[2.2rem] text-[#00a1e9] mb-8 font-bold">ギャラリーを見る</h2>
        <div className="grid gap-8 grid-cols-1 max-w-[960px] mx-auto">
          {[
            {
              img: '/images/white-thumb.jpg',
              title: 'White Gallery',
              desc: '「意識の空間」をイメージした真っ白なギャラリー。10作品限定で構成された、me-ish初期の特別展示です。',
              link: '/white',
            },
            {
              img: '/images/float-thumb.jpg',
              title: 'Float Gallery',
              desc: '「漂う」ように作品が入れ替わる、美術館風ギャラリー。テーマを設けず、日替わりで多彩な作品が展示されます。',
              link: '/float',
            },
          ].map(({ img, title, desc, link }) => (
            <Link
              href={link}
              key={title}
              className="block bg-white p-6 rounded-xl shadow-md transition-transform hover:-translate-y-1"
            >
              <img src={img} alt={title} className="w-full rounded mb-4" />
              <h3 className="text-xl text-[#00a1e9] font-semibold mb-2">{title}</h3>
              <p className="text-sm text-[#444]">{desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* 応募 */}
      <section id="apply" className="fade-in-start py-[80px] px-5 bg-white text-center">
        <div className="max-w-[700px] mx-auto">
          <h2 className="text-[2.2rem] text-[#00a1e9] font-bold mb-4">
            あなたのアートを<br />世界に届けよう
          </h2>
          <p className="text-[1.1rem] text-[#444] mb-8">me-ishでは、誰でも気軽に作品を展示できます。</p>
          <Link
            href="/entry"
            className="inline-block px-6 py-2 text-base font-semibold text-white bg-[#00a1e9] rounded-[8px] transition-colors duration-300 hover:bg-[#008ec4]"
          >
            応募する
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="fade-in-start py-[60px] px-5 bg-[#f6f8fb] text-center">
        <h2 className="text-[2rem] text-[#00a1e9] font-bold mb-8">よくある質問</h2>
        <ul className="max-w-[800px] mx-auto text-left space-y-6 text-[0.95rem] text-[#444]">
          <li>
            <strong className="text-[#333]">Q. 誰でも出展できますか？</strong>
            <p>A. はい、プロ・アマ問わずどなたでもご応募いただけます。</p>
          </li>
          <li>
            <strong className="text-[#333]">Q. 出展に料金はかかりますか？</strong>
            <p>A. β版の間は無料で展示できます。正式リリース後は手数料制を予定しています。</p>
          </li>
          <li>
            <strong className="text-[#333]">Q. NFTの販売は可能ですか？</strong>
            <p>A. はい、me-ishではNFT販売にも対応しており、円での購入も可能です。</p>
          </li>
        </ul>
        <div className="mt-8">
          <Link
            href="/faq"
            className="inline-block bg-[#00a1e9] hover:bg-[#008ec4] text-white text-sm px-6 py-2 rounded transition font-bold"
          >
            よくある質問をもっと見る
          </Link>
        </div>
      </section>

      {/* お問い合わせ */}
      <section id="contact" className="fade-in-start py-[60px] px-5 bg-white text-center">
        <h2 className="text-[2rem] text-[#00a1e9] font-bold mb-4">お問い合わせ</h2>
        <p className="mb-6">ご質問やご相談は、以下のSNSまたはメールでご連絡ください。</p>
        <ul className="text-[#00a1e9] text-sm space-y-2">
          <li>
            <a href="mailto:info@me-ish.art" className="hover:underline">
              📧 info@me-ish.art
            </a>
          </li>
          <li>
            <a
              href="https://x.com/meishart0716"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              X（Twitter）
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
};

export default MobileHome;
