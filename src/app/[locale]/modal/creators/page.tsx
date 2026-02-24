// app/creators/page.tsx
'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Upload,
  FileText,
  Image as Img,
  ShieldCheck,
  CreditCard,
  ListChecks,
  BadgeCheck,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

const flowIcons = [
  <Upload key="upload" className="w-4 h-4 text-[#00a1e9]" />,
  <FileText key="file" className="w-4 h-4 text-[#00a1e9]" />,
  <ShieldCheck key="shield" className="w-4 h-4 text-[#00a1e9]" />,
  <Img key="img" className="w-4 h-4 text-[#00a1e9]" />,
  <CreditCard key="credit" className="w-4 h-4 text-[#00a1e9]" />,
];

export default function CreatorsPage() {
  const t = useTranslations('pages.modal.creators');
  const stats = t.raw('stats') as Record<string, string>;
  const checklist = t.raw('checklist') as string[];
  const flow = t.raw('flow') as Array<{ title: string; body: string }>;
  const policy = t.raw('policy') as string[];

  return (
    <main className="px-6 py-16 max-w-3xl mx-auto text-[#222] leading-relaxed font-zen">
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
            <div className="font-extrabold">{stats.sellMain}</div>
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

      {/* 準備するもの */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-3 flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-[#00a1e9]" />
          {t('checklistTitle')}
        </h2>
        <ul className="list-disc ml-5 space-y-1 text-[0.97rem]">
          {checklist.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[#667]">{t('checklistNote')}</p>
      </section>

      {/* 出展までの流れ */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4 text-center">{t('flowTitle')}</h2>
        <ol className="space-y-4">
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
      </section>

      {/* 取り扱いと審査 */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-3">{t('policyTitle')}</h2>
        <ul className="list-disc ml-5 space-y-1 text-[0.97rem]">
          {policy.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[#667]">{t('policyNote')}</p>
      </section>

      {/* 表示保証オプションの案内 */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-3 flex items-center gap-2">
          <BadgeCheck className="w-5 h-5 text-[#00a1e9]" />
          {t('moreExposureTitle')}
        </h2>
        <p className="text-sm text-[#555]">{t('moreExposureBody')}</p>
      </section>

      {/* 応募誘導 */}
      <div className="text-center mt-14">
        <Link
          href="/entry"
          className="inline-flex items-center justify-center gap-2 bg-[#00a1e9] text-white px-6 py-3 rounded-full text-base font-semibold hover:brightness-[1.05] transition"
        >
          {t('ctaButton')} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </main>
  );
}
