// src/app/[locale]/aura/studio/page.tsx
// エントリページ → /aura/studio/new へ誘導
import Link from 'next/link';
import { ArrowRight, Palette, Pencil, Globe } from 'lucide-react';

export default function AuraStudioPage() {
  return (
    <main className="px-6 py-16 mx-auto max-w-2xl text-[#222] leading-relaxed">
      {/* Badge */}
      <div className="text-center mb-10">
        <span className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-[11px] text-[#334]">
          <Palette className="w-4 h-4 text-[#00a1e9]" />
          AURA Studio（ベータ）
        </span>

        <h1 className="mt-5 text-3xl font-extrabold tracking-tight">
          自分でつくる<br />
          <span className="text-[#00a1e9]">ポートフォリオ</span>
        </h1>

        <p className="mt-4 text-[1rem] text-[#334]">
          コンテンツはあなたが書く。デザインは視覚的に選んで調整。<br />
          シンプルな4ステップで、仕事につながるポートフォリオを公開できます。
        </p>

        <Link
          href="/aura/studio/new"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#00a1e9] px-7 py-3 text-base font-semibold text-white hover:brightness-105 transition"
        >
          はじめる <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Features */}
      <div className="grid gap-4 sm:grid-cols-3 mt-8">
        <div className="rounded-xl border bg-white p-5">
          <Pencil className="w-5 h-5 text-[#00a1e9] mb-2" />
          <h3 className="font-semibold text-sm mb-1">コンテンツは自分で</h3>
          <p className="text-xs text-[#667] leading-relaxed">
            プロフィール・作品・サービスを自由に入力できます。
          </p>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <Palette className="w-5 h-5 text-[#00a1e9] mb-2" />
          <h3 className="font-semibold text-sm mb-1">デザインを視覚的に選ぶ</h3>
          <p className="text-xs text-[#667] leading-relaxed">
            3種類のテーマからビジュアルで選択。プレビューでリアルタイム確認。
          </p>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <Globe className="w-5 h-5 text-[#00a1e9] mb-2" />
          <h3 className="font-semibold text-sm mb-1">URLを発行して公開</h3>
          <p className="text-xs text-[#667] leading-relaxed">
            完成したらそのまま公開URL発行。SNSや名刺に使えます。
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="mt-10">
        <h2 className="text-base font-bold mb-4">作成の流れ（4ステップ）</h2>
        <ol className="space-y-2">
          {[
            ['プロフィール', '名前・肩書き・自己紹介・アバターを入力'],
            ['作品・実績', '作品画像をアップロード（最大5枚）'],
            ['サービス・スキル', 'サービスメニュー・スキル・SNSリンクを設定'],
            ['テーマ選択', '3種類のデザインからプレビューで選んで公開'],
          ].map(([title, desc], i) => (
            <li key={i} className="flex gap-3 items-start rounded-xl border bg-white p-4">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e8f4ff] text-xs font-bold text-[#0a5ea8]">
                {i + 1}
              </span>
              <div>
                <div className="text-sm font-semibold">{title}</div>
                <div className="text-xs text-[#667] mt-0.5">{desc}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-10 text-center">
        <Link
          href="/aura/studio/new"
          className="inline-flex items-center gap-2 rounded-full bg-[#00a1e9] px-7 py-3 text-base font-semibold text-white hover:brightness-105 transition"
        >
          ポートフォリオを作成する <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </main>
  );
}
