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

export default function BuyersPage() {
  return (
    <main className="px-6 py-16 max-w-3xl mx-auto text-[#222] leading-relaxed">
      <h1 className="text-4xl font-lilita text-[#00a1e9] mb-10 text-center">購入ガイド</h1>

      {/* 概要 */}
      <section className="mb-10">
        <p className="text-[1.02rem]">
          me-ishでは、どなたでも展示中の作品を自由に鑑賞できます。気に入った作品はその場で購入可能です。
          <strong>お支払いはクレジットカード（円）のみ</strong>です。
        </p>
      </section>

      {/* 購入の流れ */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold mb-6 text-center">購入の流れ</h2>
        <ol className="space-y-5">
          <li className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f2ff] text-[#0a5ea8] font-bold">
              1
            </span>
            <div>
              <p className="font-semibold flex items-center gap-2">
                <Img className="w-4 h-4 text-[#00a1e9]" />
                作品を開く
              </p>
              <p className="text-sm text-[#555]">
                展示内で作品をタップし、価格や説明を確認します。
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f2ff] text-[#0a5ea8] font-bold">
              2
            </span>
            <div>
              <p className="font-semibold flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-[#00a1e9]" />
                購入手続きへ
              </p>
              <p className="text-sm text-[#555]">
                「購入する」ボタンから手続きに進みます（在庫がある場合のみ表示されます）。
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f2ff] text-[#0a5ea8] font-bold">
              3
            </span>
            <div>
              <p className="font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#00a1e9]" />
                クレジット決済
              </p>
              <p className="text-sm text-[#555]">
                Stripe経由で安全に決済します（<strong>円のみ</strong>）。
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f2ff] text-[#0a5ea8] font-bold">
              4
            </span>
            <div>
              <p className="font-semibold flex items-center gap-2">
                <Download className="w-4 h-4 text-[#00a1e9]" />
                データ受け取り
              </p>
              <p className="text-sm text-[#555]">
                購入完了後、<strong>ダウンロードリンクをメール</strong>でお送りします。
              </p>
            </div>
          </li>
        </ol>

        <p className="mt-3 text-xs text-[#667]">
          ※ 購入後は作品に「SOLD」表示がつき、展示期間中もギャラリー内に表示され続けます（鑑賞体験のため）。
        </p>
      </section>

      {/* 作品の保護について */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#00a1e9]" />
          作品の保護と取り扱い
        </h2>
        <ul className="list-disc ml-6 space-y-2 text-sm">
          <li>表示用画像にはウォーターマークやAI認識阻害処理（例：Glaze）を適用しています。</li>
          <li>購入データの利用範囲は「私的鑑賞」の範囲に限られます（著作権の譲渡はありません）。</li>
        </ul>
        <p className="mt-2 text-xs text-[#667]">
          詳細は <Link href="/footer/faq#policy" className="underline">FAQ</Link> をご確認ください。
        </p>
      </section>

      {/* よくある質問 */}
      <section className="mb-14">
        <h2 className="text-xl font-bold mb-3">よくあるご質問</h2>
        <ul className="space-y-4 text-sm">
          <li>
            <strong>Q. 支払い方法は？</strong>
            <br />
            → クレジットカード（円）のみです。暗号資産での支払いには対応していません。
          </li>

          <li>
            <strong>Q. キャンセルや返品はできますか？</strong>
            <br />
            → デジタル商品の性質上、原則キャンセルはできません。誤購入等は{' '}
            <Link href="/#contact" className="underline">お問い合わせ</Link> からご相談ください。
          </li>
        </ul>
      </section>

      {/* CTA */}
      <div className="mt-12 grid gap-3 sm:grid-cols-2">
        <Link
          href="/#gallery"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-[#00a1e9] px-5 py-3 text-[#00a1e9] font-semibold hover:bg-[#e8f7ff] transition"
        >
          作品を見に行く <ArrowRight className="w-4 h-4" />
        </Link>

        <Link
          href="/footer/faq"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#00a1e9] px-5 py-3 text-white font-semibold hover:brightness-[1.05] transition"
        >
          FAQを見る <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </main>
  );
}
