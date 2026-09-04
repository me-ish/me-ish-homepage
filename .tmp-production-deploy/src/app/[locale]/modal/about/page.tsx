// app/about/page.tsx
'use client';

import Link from 'next/link';
import { Sparkles, Images, ShieldCheck, ArrowRight, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

const featureIcons = [
  <Sparkles key="sparkles" className="w-5 h-5 text-[#00a1e9]" />,
  <Images key="images" className="w-5 h-5 text-[#00a1e9]" />,
  <ShieldCheck key="shield" className="w-5 h-5 text-[#00a1e9]" />,
];

export default function AboutPage() {
  const t = useTranslations('pages.modal.about');
  const stats = t.raw('stats') as Record<string, string>;
  const features = t.raw('features') as Array<{ title: string; body: string }>;
  const steps = t.raw('steps') as Array<{ t: string; d: string }>;
  const recommend = t.raw('recommend') as string[];

  return (
    <main className="px-6 py-16 max-w-3xl mx-auto text-[#222] leading-relaxed">
      <h1 className="text-4xl font-lilita text-[#00a1e9] mb-10 text-center">{t('title')}</h1>

      {/* リード */}
      <section className="mb-8">
        <p className="text-[1.02rem]">{t('lead')}</p>
      </section>

      {/* 基本情報 */}
      <section className="mb-10">
        <ul className="grid gap-3 sm:grid-cols-4">
          <li className="rounded-2xl border bg-[#f6f8fb] px-4 py-3">
            <div className="text-[11px] text-[#667]">{stats.joinLabel}</div>
            <div className="font-extrabold tracking-tight">{stats.joinMain}</div>
            <div className="mt-0.5 text-xs text-[#667]">{stats.joinSub}</div>
          </li>
          <li className="rounded-2xl border bg-[#f6f8fb] px-4 py-3">
            <div className="text-[11px] text-[#667]">{stats.sellLabel}</div>
            <div className="font-extrabold tracking-tight">{stats.sellMain}</div>
            <div className="mt-0.5 text-xs text-[#667]">{stats.sellSub}</div>
          </li>
          <li className="rounded-2xl border bg-[#f6f8fb] px-4 py-3">
            <div className="text-[11px] text-[#667]">{stats.paymentLabel}</div>
            <div className="font-extrabold tracking-tight">{stats.paymentMain}</div>
            <div className="mt-0.5 text-xs text-[#667]">{stats.paymentSub}</div>
          </li>
          <li className="rounded-2xl border bg-[#f6f8fb] px-4 py-3">
            <div className="text-[11px] text-[#667]">{stats.settingsLabel}</div>
            <div className="font-extrabold tracking-tight">{stats.settingsMain}</div>
            <div className="mt-0.5 text-xs text-[#667]">{stats.settingsSub}</div>
          </li>
        </ul>

        <p className="mt-2 text-xs text-[#667]">{t('statsNote')}</p>
      </section>

      {/* 特長（3カード） */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-3">{t('featuresTitle')}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((f, i) => (
            <div key={i} className="rounded-2xl border bg-[#f6f8fb] p-5">
              {featureIcons[i]}
              <p className="mt-2 font-semibold">{f.title}</p>
              <p className="mt-1 text-sm text-[#555]">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 使い方（ステップ） */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-3">{t('stepsTitle')}</h2>
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e7f2ff] text-[#0a5ea8] text-xs font-bold">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold">{s.t}</p>
                <p className="text-sm text-[#555]">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* こんな方におすすめ */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-3">{t('recommendTitle')}</h2>
        <ul className="list-disc ml-5 space-y-1 text-[0.97rem]">
          {recommend.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>

      {/* 作品保護への取り組み */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-3">{t('protectionTitle')}</h2>
        <p className="text-[0.97rem]">{t('protectionBody')}</p>
        <p className="mt-2 text-xs text-[#667]">{t('protectionNote')}</p>
      </section>

      {/* 背景ストーリー */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-3">{t('whyTitle')}</h2>
        <p>{t('whyBody')}</p>
      </section>

      {/* CTA */}
      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <Link
          href="/modal/creators"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#00a1e9] px-5 py-3 text-white font-semibold hover:brightness-[1.05] transition"
        >
          {t('ctaGuide')} <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/float"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-[#00a1e9] px-5 py-3 text-[#00a1e9] font-semibold hover:bg-[#e8f7ff] transition"
        >
          {t('ctaGallery')} <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </main>
  );
}
