'use client';

import Link from 'next/link';
import { Check, Star, Info, ArrowRight, Percent } from 'lucide-react';

export default function PricingPage() {
  return (
    <main className="px-6 py-16 max-w-3xl mx-auto text-[#222] leading-relaxed">
      <h1 className="text-4xl font-lilita text-[#00a1e9] mb-10 text-center">プランと料金</h1>

      {/* リード */}
      <section className="mb-8">
        <p className="text-[1.02rem]">
          me-ishは<strong>応募・展示無料</strong>。作品が<strong>売れたときだけ手数料15%</strong>（クレジット〈円〉決済）。
          さらに確実に見てもらいたい方向けに、<strong>表示保証オプション</strong>をご用意しています。
        </p>
      </section>

      {/* 表示保証オプション */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-3">表示保証オプション（任意）</h2>
        <p className="text-sm text-[#667] mb-4">
          期間中に、下記回数は必ずギャラリーで表示されます（一般ローテーションは別途実施）。
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <PlanCard name="Mini"      price={400}  period="1ヶ月" guarantees={1}  pace="月1回の確実な露出" />
          <PlanCard name="Light"     price={800}  period="1ヶ月" guarantees={3}  pace="週1回ペースで優先表示" />
          <PlanCard name="Standard"  price={1500} period="1ヶ月" guarantees={7}  pace="週2回＋αで優先表示" featured />
          <PlanCard name="Premium"   price={2800} period="1ヶ月" guarantees={15} pace="2日に1回ペースで優先表示" />
        </div>
      </section>

      {/* 注釈 */}
      <section className="mb-14">
        <h3 className="text-xl font-bold mb-3">ご利用前に</h3>
        <ul className="list-disc ml-6 space-y-2 text-sm">
          <li>オプションは<strong>1作品ごと</strong>に適用され、<strong>購入日から1ヶ月</strong>有効です。</li>
          <li><strong>表示保証回数</strong>は、その回数分ユーザーの表示枠に登場することを指します（クリック有無は不問）。</li>
          <li>保証回数消化後も、一般ローテーションで掲載されます（非保証枠）。</li>
          <li>お支払いは<strong>クレジットカード（円）</strong>のみ対応です。</li>
          <li>販売手数料は<strong>成功時のみ15%</strong>。詳細は <Link href="/footer/faq#fees" className="underline">FAQ</Link> をご確認ください。</li>
        </ul>
      </section>

      {/* CTA */}
      <div className="text-center">
        <Link
          href="/entry"
          className="inline-flex items-center justify-center gap-2 bg-[#00a1e9] text-white px-6 py-3 rounded-full text-base font-semibold hover:brightness-[1.05] transition"
        >
          応募フォームへ進む <ArrowRight className="w-4 h-4" />
        </Link>
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
  featured = false,
}: {
  name: string;
  price: number;          // 税込価格（円）
  period: string;         // 例: "1ヶ月"
  guarantees: number;     // 表示保証回数
  pace: string;
  featured?: boolean;
}) {
  const unit = Math.round(price / guarantees); // 1回あたり
  const formatYen = (n: number) => `¥${n.toLocaleString()}`;

  return (
    <div
      className={`relative rounded-2xl border bg-[#f6f8fb] p-5 flex flex-col ${
        featured ? 'ring-2 ring-[#00a1e9]/60 bg-white' : ''
      }`}
    >
      {featured && (
        <div className="absolute -top-2 right-3 inline-flex items-center gap-1 rounded-full bg-[#00a1e9] text-white text-[11px] px-2 py-1">
          <Star className="w-3 h-3" /> おすすめ
        </div>
      )}

      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold">{name}</h3>
        <div className="text-right">
          <div className="text-2xl font-extrabold tracking-tight">{formatYen(price)}</div>
          <div className="text-[11px] text-[#667]">{period}</div>
        </div>
      </div>

      {/* 数値をひと目で：保証回数 / 1回あたり料金 */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white border px-3 py-2">
          <div className="text-[11px] text-[#667]">保証表示回数</div>
          <div className="font-semibold">{guarantees}回</div>
        </div>
        <div className="rounded-xl bg-white border px-3 py-2">
          <div className="text-[11px] text-[#667] flex items-center gap-1">
            1回あたり <Percent className="w-3 h-3 text-[#00a1e9]" />
          </div>
          <div className="font-semibold">約 {formatYen(unit)}</div>
        </div>
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        <li className="flex items-start gap-2">
          <Check className="w-4 h-4 text-[#00a1e9] mt-0.5" />
          <span>{pace}</span>
        </li>
        <li className="flex items-start gap-2 text-[#667]">
          <Info className="w-4 h-4 mt-0.5" />
          <span>一般ローテーション表示と併用</span>
        </li>
      </ul>

      {/* ← 各カードのボタンは削除（エントリーはページ下部のCTAに集約） */}
    </div>
  );
}
