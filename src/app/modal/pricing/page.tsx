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

export default function PricingPage() {
  return (
    <main className="px-6 py-16 mx-auto max-w-3xl text-[#222] leading-relaxed font-zen">
      {/* Header */}
      <header className="text-center mb-10">
        <h1 className="text-4xl font-lilita text-[#00a1e9] mb-3">プランと料金</h1>
        <p className="text-[1.02rem] text-[#334]">
          me-ishは<strong>応募・展示は無料</strong>。作品が<strong>売れたときだけ手数料10%</strong>。<br />
          確実な露出を求める方向けに<strong>表示保証オプション</strong>を用意しています。
        </p>
      </header>

      {/* 表示保証オプション */}
      <section aria-labelledby="guarantee" className="mb-12">
        <h2 id="guarantee" className="text-xl font-bold mb-3">表示保証オプション（任意）</h2>
        <p className="text-sm text-[#667] mb-4">
          購入から有効期間内に、下記回数は必ずギャラリーで表示されます（一般ローテーションは別で実施）。
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <PlanCard name="Mini"     price={400}  period="1ヶ月" guarantees={4}  pace="週1回ペースで確実な露出" />
          <PlanCard name="Light"    price={800}  period="1ヶ月" guarantees={9}  pace="週2回前後で優先表示" />
          <PlanCard name="Standard" price={1200} period="1ヶ月" guarantees={14} pace="週3〜4回でしっかり露出" featured />
          <PlanCard name="Premium"  price={2400} period="1ヶ月" guarantees={30} pace="ほぼ毎日ペースで優先表示" />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-[#556]">
          <Badge className="bg-white">1作品ごとに適用</Badge>
          <Badge className="bg-white">有効期限：購入日から1ヶ月</Badge>
          <Badge className="bg-white">一般ローテーション併用</Badge>
        </div>
      </section>

      {/* 手数料・決済 */}
      <section aria-labelledby="fees" className="mb-10">
        <h2 id="fees" className="text-xl font-bold mb-3">手数料・決済</h2>
        <ul className="list-disc ml-6 space-y-2 text-sm">
          <li>
            <strong>販売手数料は成功時のみ10%</strong>です。売上から<strong>手数料を控除</strong>のうえ、
            <strong>月次まとめ払い</strong>でアーティストへ<strong>銀行振込</strong>します（応募時に振込口座の登録が必要）。
          </li>
          <li>
            購入者の決済方法は<strong>クレジットカード（円）</strong>です。NFT作品も円で購入できます。
          </li>
          <li>
            詳細は <Link href="/footer/faq#fees" className="underline">FAQ</Link> をご確認ください。
          </li>
        </ul>
      </section>

      {/* 規約の要点（抜粋） */}
      <section aria-labelledby="terms" className="mb-14">
        <h2 id="terms" className="text-xl font-bold mb-3">ご利用規約（要点抜粋）</h2>
        <div className="rounded-2xl border bg-[#f6f8fb] p-5">
          <ul className="space-y-3 text-sm">
            <TermItem
              icon={<Shield className="w-4 h-4 text-[#00a1e9]" />}
              title="作品権利・保護"
              body="著作権はアーティストに帰属。展示・販売・広報に必要な範囲での利用許諾をいただきます。me-ish側でサイン／ウォーターマーク、AI認識阻害処理（Glaze・ステガノ等）を適用し、保護完了後のみ展示します。"
            />
            <TermItem
              icon={<BadgeCheck className="w-4 h-4 text-[#00a1e9]" />}
              title="審査と掲載"
              body="応募＝掲載確定ではありません。審査通過後に掲載・販売開始となります（審査結果はメール通知）。SOLD後も展示を継続します。"
            />
            <TermItem
              icon={<Info className="w-4 h-4 text-[#00a1e9]" />}
              title="表示保証の扱い"
              body="オプションは1作品ごとに購入でき、有効期間内に保証回数を消化します。保証回数消化後も一般ローテーションでの表示は継続されます。"
            />
            <TermItem
              icon={<RotateCcw className="w-4 h-4 text-[#00a1e9]" />}
              title="キャンセル・返金"
              body="表示保証オプションは性質上、購入後の返金はできません（法令上の瑕疵に該当する場合を除く）。"
            />
            <TermItem
              icon={<Info className="w-4 h-4 text-[#00a1e9]" />}
              title="NFT販売（該当作品）"
              body="me-ishが独自コントラクトでMintし、購入者へ付与します。NFTはトークンの所有権であり、著作権の移転を意味しません。詳細は「NFT販売ガイド」をご確認ください。"
            />
          </ul>

          <div className="mt-4 text-right">
            <Link href="/footer/terms" className="inline-flex items-center gap-1 text-[13px] underline">
              利用規約（全文）を見る <ArrowRight className="w-4 h-4" />
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
          応募フォームへ進む <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="text-xs text-[#667] mt-2">まずは無料で応募。掲載は審査通過後に開始されます。</p>
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
  const perUnit = Math.max(1, Math.round(price / Math.max(1, guarantees))); // 1回あたり
  const formatYen = (n: number) => `¥${n.toLocaleString()}`;

  return (
    <article
      className={`relative rounded-2xl border bg-[#f6f8fb] p-5 flex flex-col ${
        featured ? 'ring-2 ring-[#00a1e9]/60 bg-white' : ''
      }`}
      aria-label={`${name}プラン`}
    >
      {featured && (
        <div
          aria-hidden
          className="absolute -top-2 right-3 inline-flex items-center gap-1 rounded-full bg-[#00a1e9] text-white text-[11px] px-2 py-1 shadow-sm"
        >
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

      {/* 保証回数 / 1回あたり料金 */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <KPI label="保証表示回数" value={`${guarantees}回`} />
        <KPI
          label={<span className="flex items-center gap-1">1回あたり<Percent className="w-3 h-3 text-[#00a1e9]" /></span>}
          value={`約 ${formatYen(perUnit)}`}
        />
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        <LI icon={<Check className="w-4 h-4 text-[#00a1e9] mt-0.5" />}>{pace}</LI>
        <LI muted icon={<Info className="w-4 h-4 mt-0.5" />}>一般ローテーション表示と併用</LI>
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
