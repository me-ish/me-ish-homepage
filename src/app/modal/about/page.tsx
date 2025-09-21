// app/about/page.tsx
'use client';

import Link from 'next/link';
import { Sparkles, Images, ShieldCheck, ArrowRight, ChevronRight } from 'lucide-react';

export default function AboutPage() {
  return (
    <main className="px-6 py-16 max-w-3xl mx-auto text-[#222] leading-relaxed">
      <h1 className="text-4xl font-lilita text-[#00a1e9] mb-10 text-center">me-ishについて</h1>

      {/* リード */}
      <section className="mb-8">
        <p className="text-[1.02rem]">
          me-ish（ミーイッシュ）は、誰もが自分らしく作品を展示できるオンラインギャラリー。
          3D的な見せ方や独自UIで鑑賞体験をアップデートし、作品の“見せ方”と“出会い方”をデザインします。
        </p>
      </section>

      {/* 基本情報（仕様を最新に反映） */}
<section className="mb-10">
  <ul className="grid gap-3 sm:grid-cols-4">
    {/* 応募・展示無料 */}
    <li className="rounded-2xl border bg-[#f6f8fb] px-4 py-3">
      <div className="text-[11px] text-[#667]">参加</div>
      <div className="font-extrabold tracking-tight">応募・展示無料</div>
      <div className="mt-0.5 text-xs text-[#667]">はじめてでも費用はかかりません</div>
    </li>

    {/* 販売成立時のみ手数料 15% */}
    <li className="rounded-2xl border bg-[#f6f8fb] px-4 py-3">
      <div className="text-[11px] text-[#667]">販売</div>
      <div className="font-extrabold tracking-tight">手数料15％</div>
      <div className="mt-0.5 text-xs text-[#667]">販売成立時のみ ／ 売れなければ費用ゼロ</div>
    </li>

    {/* クレジット（円）のみ */}
    <li className="rounded-2xl border bg-[#f6f8fb] px-4 py-3">
      <div className="text-[11px] text-[#667]">決済</div>
      <div className="font-extrabold tracking-tight">クレジットのみ</div>
      <div className="mt-0.5 text-xs text-[#667]">暗号資産での支払いには非対応</div>
    </li>

    {/* NFT受け渡し対応（希望者） */}
    <li className="rounded-2xl border bg-[#f6f8fb] px-4 py-3">
      <div className="text-[11px] text-[#667]">出展形式</div>
      <div className="font-extrabold tracking-tight">通常 / NFT を選択</div>
      <div className="mt-0.5 text-xs text-[#667]">応募時に選択。NFT選択作品は購入後に発行・受け渡し</div>
    </li>
  </ul>

  {/* フッターノート */}
<p className="mt-2 text-xs text-[#667]">
  ※ 決済は購入者のクレジットカード（円）のみ。アーティストへのお支払いは
  売上から手数料（15%）を控除のうえ、月次で銀行振込します。
  詳細は <a href="/footer/faq#fees" className="underline">FAQ</a> をご確認ください。
</p>

</section>


      {/* 特長（3カード） */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-3">特長</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-[#f6f8fb] p-5">
            <Sparkles className="w-5 h-5 text-[#00a1e9]" />
            <p className="mt-2 font-semibold">作品が映える体験設計</p>
            <p className="mt-1 text-sm text-[#555]">
              ホログラム風ラベルや空間演出など、作品の魅力を最大化するUI。
            </p>
          </div>
          <div className="rounded-2xl border bg-[#f6f8fb] p-5">
            <Images className="w-5 h-5 text-[#00a1e9]" />
            <p className="mt-2 font-semibold">簡単な出展フロー</p>
            <p className="mt-1 text-sm text-[#555]">
              ガイド付き応募で迷わない。通常販売＋NFT受け渡し（任意）に対応。{/* ← 文言調整 */}
            </p>
          </div>
          <div className="rounded-2xl border bg-[#f6f8fb] p-5">
            <ShieldCheck className="w-5 h-5 text-[#00a1e9]" />
            <p className="mt-2 font-semibold">画像保護と安心運営</p>
            <p className="mt-1 text-sm text-[#555]">
              サイン/ウォーターマークやAI認識阻害など多層的に保護。ポリシーも整備。
            </p>
          </div>
        </div>
      </section>

      {/* 使い方（ステップ） */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-3">使い方（5ステップ）</h2>
        <ol className="space-y-3">
          {[
            { t: '応募', d: '作品情報を入力して画像をアップロード。ガイドに沿って進むだけ。' },
            { t: '審査', d: '基本的な基準に沿ってクイックレビュー。結果はメール通知。' },
            { t: '展示', d: 'White / Float などギャラリーへ掲出。SOLDやエディション情報も自動表示。' },
            { t: '販売', d: 'クレジット決済（円）。販売形式は出展者設定（通常／NFT）。' }, // ← ここ更新
            { t: '還元', d: '売上は規定に沿って月次で銀行振込。明細はマイページから確認予定。' },
          ].map((s, i) => (
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
        <h2 className="text-2xl font-bold mb-3">こんな方におすすめ</h2>
        <ul className="list-disc ml-5 space-y-1 text-[0.97rem]">
          <li>まだ知られていないが、真剣に作品を届けたいアーティスト</li>
          <li>NFT受け渡しも選べる環境で販売したい方</li> {/* ← 文言微調整 */}
          <li>スマホでも気軽にアートを楽しみたい方</li>
          <li>新しい才能を発掘したいコレクター</li>
        </ul>
      </section>

      {/* 背景・姿勢 */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-3">作品保護への取り組み</h2>
        <p className="text-[0.97rem]">
          表示用画像にはウォーターマークやAI認識阻害などの対策を適用。オリジナルデータの扱い、二次利用、削除依頼のフローは順次公開予定です。
        </p>
        <p className="mt-2 text-xs text-[#667]">
          詳細は <Link href="/footer/faq" className="underline">FAQ</Link> をご確認ください。
        </p>
      </section>

      {/* 背景ストーリー */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-3">なぜme-ishを作ったのか</h2>
        <p>
          才能があるのに日の目を見ない作品を多く見てきました。展示のハードルを下げつつ、作品はしっかり守る——その両立を目指して生まれたのが me-ish です。
        </p>
      </section>

      {/* CTA */}
      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <Link
          href="/modal/creators"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#00a1e9] px-5 py-3 text-white font-semibold hover:brightness-[1.05] transition"
        >
          出展ガイドを見る <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/float"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-[#00a1e9] px-5 py-3 text-[#00a1e9] font-semibold hover:bg-[#e8f7ff] transition"
        >
          ギャラリーへ行く <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </main>
  );
}
