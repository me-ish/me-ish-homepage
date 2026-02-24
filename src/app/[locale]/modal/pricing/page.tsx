'use client';

import Link from 'next/link';
import {
  Check,
  Star,
  Info,
  ArrowRight,
  Percent,
  Shield,
  BadgeCheck,
  RotateCcw,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function PricingPage() {
  const t = useTranslations('pages.modal.pricing');
  const termsItems = t.raw('termsItems') as Array<{ title: string; body: string }>;

  return (
    <main className="px-6 py-16 mx-auto max-w-3xl text-[#222] leading-relaxed font-zen">
      {/* Header */}
      <header className="text-center mb-10">
        <h1 className="text-4xl font-lilita text-[#00a1e9] mb-3">{t('title')}</h1>
        <p className="text-[1.02rem] text-[#334]">
          <strong>{t('leadFreeStrong')}</strong>。<strong>{t('leadSellStrong')}</strong>。<br />
          <strong>{t('leadOptionStrong')}</strong>{t('leadSuffix')}
        </p>
      </header>

      {/* 表示保証オプション */}
      <section aria-labelledby="guarantee" className="mb-12">
        <h2 id="guarantee" className="text-xl font-bold mb-3">{t('guaranteeTitle')}</h2>
        <p className="text-sm text-[#667] mb-4">{t('guaranteeDesc')}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <PlanCard name="Mini"     price={400}  guarantees={4}  pace={t('planPaces.mini')}     period={t('period')} recommended={t('recommended')} kpiGuarantee={t('kpiGuarantee')} kpiPerUnit={t('kpiPerUnit')} comboNote={t('comboNote')} />
          <PlanCard name="Light"    price={800}  guarantees={9}  pace={t('planPaces.light')}    period={t('period')} recommended={t('recommended')} kpiGuarantee={t('kpiGuarantee')} kpiPerUnit={t('kpiPerUnit')} comboNote={t('comboNote')} />
          <PlanCard name="Standard" price={1200} guarantees={14} pace={t('planPaces.standard')} period={t('period')} recommended={t('recommended')} kpiGuarantee={t('kpiGuarantee')} kpiPerUnit={t('kpiPerUnit')} comboNote={t('comboNote')} featured />
          <PlanCard name="Premium"  price={2400} guarantees={30} pace={t('planPaces.premium')}  period={t('period')} recommended={t('recommended')} kpiGuarantee={t('kpiGuarantee')} kpiPerUnit={t('kpiPerUnit')} comboNote={t('comboNote')} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-[#556]">
          <Badge className="bg-white">{t('badgePerWork')}</Badge>
          <Badge className="bg-white">{t('badgePeriod')}</Badge>
          <Badge className="bg-white">{t('badgeCombo')}</Badge>
        </div>
      </section>

      {/* 手数料・決済 */}
      <section aria-labelledby="fees" className="mb-10">
        <h2 id="fees" className="text-xl font-bold mb-3">{t('feesTitle')}</h2>
        <ul className="list-disc ml-6 space-y-2 text-sm">
          <li>{t('feeItem1')}</li>
          <li>{t('feeItem2')}</li>
          <li>{t('feeItem3')}</li>
        </ul>
      </section>

      {/* 規約の要点 */}
      <section aria-labelledby="terms" className="mb-14">
        <h2 id="terms" className="text-xl font-bold mb-3">{t('termsTitle')}</h2>
        <div className="rounded-2xl border bg-[#f6f8fb] p-5">
          <ul className="space-y-3 text-sm">
            <TermItem icon={<Shield className="w-4 h-4 text-[#00a1e9]" />}     title={termsItems[0].title} body={termsItems[0].body} />
            <TermItem icon={<BadgeCheck className="w-4 h-4 text-[#00a1e9]" />} title={termsItems[1].title} body={termsItems[1].body} />
            <TermItem icon={<Info className="w-4 h-4 text-[#00a1e9]" />}       title={termsItems[2].title} body={termsItems[2].body} />
            <TermItem icon={<RotateCcw className="w-4 h-4 text-[#00a1e9]" />}  title={termsItems[3].title} body={termsItems[3].body} />
          </ul>

          <div className="mt-4 text-right">
            <Link href="/footer/terms" className="inline-flex items-center gap-1 text-[13px] underline">
              {t('termsViewFull')} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <div className="text-center">
        <Link
          href="/entry"
          className="inline-flex items-center justify-center gap-2 bg-[#00a1e9] text-white px-6 py-3 rounded-full text-base font-semibold hover:brightness-[1.05] transition"
        >
          {t('ctaButton')} <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="text-xs text-[#667] mt-2">{t('ctaNote')}</p>
      </div>
    </main>
  );
}

/* ---------- Sub Components ---------- */

function PlanCard({
  name,
  price,
  period,
  guarantees,
  pace,
  recommended,
  kpiGuarantee,
  kpiPerUnit,
  comboNote,
  featured = false,
}: {
  name: string;
  price: number;
  period: string;
  guarantees: number;
  pace: string;
  recommended: string;
  kpiGuarantee: string;
  kpiPerUnit: string;
  comboNote: string;
  featured?: boolean;
}) {
  const perUnit = Math.max(1, Math.round(price / Math.max(1, guarantees)));
  const formatYen = (n: number) => `¥${n.toLocaleString()}`;

  return (
    <article
      className={`relative rounded-2xl border bg-[#f6f8fb] p-5 flex flex-col ${
        featured ? 'ring-2 ring-[#00a1e9]/60 bg-white' : ''
      }`}
      aria-label={`${name}`}
    >
      {featured && (
        <div
          aria-hidden
          className="absolute -top-2 right-3 inline-flex items-center gap-1 rounded-full bg-[#00a1e9] text-white text-[11px] px-2 py-1 shadow-sm"
        >
          <Star className="w-3 h-3" /> {recommended}
        </div>
      )}

      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold">{name}</h3>
        <div className="text-right">
          <div className="text-2xl font-extrabold tracking-tight">{formatYen(price)}</div>
          <div className="text-[11px] text-[#667]">{period}</div>
        </div>
      </div>

      {/* 保証回数 / 1回あたり料金 */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <KPI label={kpiGuarantee} value={`${guarantees}`} />
        <KPI
          label={<span className="flex items-center gap-1">{kpiPerUnit}<Percent className="w-3 h-3 text-[#00a1e9]" /></span>}
          value={`~ ${formatYen(perUnit)}`}
        />
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        <LI icon={<Check className="w-4 h-4 text-[#00a1e9] mt-0.5" />}>{pace}</LI>
        <LI muted icon={<Info className="w-4 h-4 mt-0.5" />}>{comboNote}</LI>
      </ul>
    </article>
  );
}

function KPI({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="rounded-xl bg-white border px-3 py-2">
      <div className="text-[11px] text-[#667]">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function LI({ children, icon, muted = false }: { children: React.ReactNode; icon: React.ReactNode; muted?: boolean }) {
  return (
    <li className={`flex items-start gap-2 ${muted ? 'text-[#667]' : ''}`}>
      {icon}
      <span>{children}</span>
    </li>
  );
}

function TermItem({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <li className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div>
        <div className="font-medium">{title}</div>
        <p className="text-[#445]">{body}</p>
      </div>
    </li>
  );
}

function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 ${className}`}>
      {children}
    </span>
  );
}
