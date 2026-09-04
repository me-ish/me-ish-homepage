// app/buyers/page.tsx
'use client';

import Link from 'next/link';
import {
  ShoppingCart,
  CreditCard,
  ShieldCheck,
  Download,
  Image as Img,
  ArrowRight,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

const flowIcons = [
  <Img key="img" className="w-4 h-4 text-[#00a1e9]" />,
  <ShoppingCart key="cart" className="w-4 h-4 text-[#00a1e9]" />,
  <CreditCard key="credit" className="w-4 h-4 text-[#00a1e9]" />,
  <Download key="download" className="w-4 h-4 text-[#00a1e9]" />,
];

export default function BuyersPage() {
  const t = useTranslations('pages.modal.buyers');
  const flow = t.raw('flow') as Array<{ title: string; body: string }>;
  const protectionItems = t.raw('protectionItems') as string[];
  const faqItems = t.raw('faqItems') as Array<{ q: string; a: string }>;

  return (
    <main className="px-6 py-16 max-w-3xl mx-auto text-[#222] leading-relaxed">
      <h1 className="text-4xl font-lilita text-[#00a1e9] mb-10 text-center">{t('title')}</h1>

      {/* 概要 */}
      <section className="mb-10">
        <p className="text-[1.02rem]">{t('lead')}</p>
      </section>

      {/* 購入の流れ */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold mb-6 text-center">{t('flowTitle')}</h2>
        <ol className="space-y-5">
          {flow.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f2ff] text-[#0a5ea8] font-bold">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold flex items-center gap-2">
                  {flowIcons[i]}
                  {step.title}
                </p>
                <p className="text-sm text-[#555]">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-[#667]">{t('flowNote')}</p>
      </section>

      {/* 作品の保護について */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#00a1e9]" />
          {t('protectionTitle')}
        </h2>
        <ul className="list-disc ml-6 space-y-2 text-sm">
          {protectionItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>

      {/* よくある質問 */}
      <section className="mb-14">
        <h2 className="text-xl font-bold mb-3">{t('faqTitle')}</h2>
        <ul className="space-y-4 text-sm">
          {faqItems.map((item, i) => (
            <li key={i}>
              <strong>{item.q}</strong>
              <br />
              {item.a}
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <div className="mt-12 grid gap-3 sm:grid-cols-2">
        <Link
          href="/#gallery"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-[#00a1e9] px-5 py-3 text-[#00a1e9] font-semibold hover:bg-[#e8f7ff] transition"
        >
          {t('ctaGallery')} <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/footer/faq"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#00a1e9] px-5 py-3 text-white font-semibold hover:brightness-[1.05] transition"
        >
          {t('ctaFaq')} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </main>
  );
}
