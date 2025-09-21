// app/buyers/page.tsx
'use client';

import Link from 'next/link';
import {
  ShoppingCart, CreditCard, Wallet, ShieldCheck, Download, Image as Img, ArrowRight, Timer
} from 'lucide-react';

export default function BuyersPage() {
  return (
    <main className="px-6 py-16 max-w-3xl mx-auto text-[#222] leading-relaxed">
      <h1 className="text-4xl font-lilita text-[#00a1e9] mb-10 text-center">購入ガイド</h1>

      {/* 概要 */}
      <section className="mb-10">
<p className="text-[1.02rem]">
  me-ishでは、どなたでも展示中の作品を自由に鑑賞できます。気に入った作品はその場で購入可能。
  <strong>お支払いはクレジットカード（円）のみ</strong>です。
  作品には<span className="font-semibold">「通常」</span>と<span className="font-semibold">「NFT」</span>の出展形式があり、
  <strong>NFT対応作品のみ</strong>、購入後に<strong>希望者へ</strong>NFTを付与します
  （<strong>受け取り任意</strong>／ウォレット未所持でも<strong>メール受け取り可</strong>／<strong>著作権は移転しません</strong>）。
</p>

      </section>

      {/* 通常販売（円） */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold mb-6 text-center">通常販売（円）の流れ</h2>
        <ol className="space-y-5">
          <li className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f2ff] text-[#0a5ea8] font-bold">1</span>
            <div>
              <p className="font-semibold flex items-center gap-2"><Img className="w-4 h-4 text-[#00a1e9]" />作品を開く</p>
              <p className="text-sm text-[#555]">展示内で作品をタップし、価格や説明を確認します。</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f2ff] text-[#0a5ea8] font-bold">2</span>
            <div>
              <p className="font-semibold flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-[#00a1e9]" />購入手続きへ</p>
              <p className="text-sm text-[#555]">「購入する」ボタンから手続きに進みます。</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f2ff] text-[#0a5ea8] font-bold">3</span>
            <div>
              <p className="font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4 text-[#00a1e9]" />クレジット決済</p>
              <p className="text-sm text-[#555]">Stripe経由で安全に決済（<strong>円のみ</strong>）。</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f2ff] text-[#0a5ea8] font-bold">4</span>
            <div>
              <p className="font-semibold flex items-center gap-2"><Download className="w-4 h-4 text-[#00a1e9]" />データ受け取り</p>
              <p className="text-sm text-[#555]">購入完了後、<strong>ダウンロードリンクをメール</strong>でお送りします。</p>
            </div>
          </li>
        </ol>
      </section>

      {/* NFT出展作品の購入 */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold mb-6 text-center">NFT出展作品の購入</h2>
        <ol className="space-y-5">
          <li className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f2ff] text-[#0a5ea8] font-bold">1</span>
            <div>
              <p className="font-semibold flex items-center gap-2"><Img className="w-4 h-4 text-[#00a1e9]" />NFT表示の作品を選ぶ</p>
              <p className="text-sm text-[#555]">作品詳細に「NFT」出展と明記されています。</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f2ff] text-[#0a5ea8] font-bold">2</span>
            <div>
              <p className="font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4 text-[#00a1e9]" />クレジットで購入（円）</p>
              <p className="text-sm text-[#555]">お支払いは通常販売と同じく<strong>クレジットカードのみ</strong>です。</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f2ff] text-[#0a5ea8] font-bold">3</span>
            <div>
              <p className="font-semibold flex items-center gap-2"><Wallet className="w-4 h-4 text-[#00a1e9]" />受け取り方法を確認</p>
<p className="text-sm text-[#555]">
  ウォレットをお持ちの方はアドレスを入力。お持ちでない場合は
  <strong>メール受け取り</strong>（後からウォレット作成でも可）に対応します。
</p>

            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f2ff] text-[#0a5ea8] font-bold">4</span>
            <div>
              <p className="font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#00a1e9]" />NFTを発行・受け渡し</p>
              <p className="text-sm text-[#555]">
                当ギャラリーが購入後にNFTを発行し、指定ウォレットへ移転します（<Timer className="inline w-3.5 h-3.5" /> 発行まで少しお時間をいただきます）。
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f2ff] text-[#0a5ea8] font-bold">5</span>
            <div>
              <p className="font-semibold flex items-center gap-2"><Download className="w-4 h-4 text-[#00a1e9]" />データも受け取り</p>
              <p className="text-sm text-[#555]">
                NFT作品でも、<strong>画像データ（保護済み＋原本）</strong>のダウンロードリンクをメールでお送りします。
              </p>
            </div>
          </li>
        </ol>
        <p className="mt-3 text-xs text-[#667]">
          ※ 暗号資産での支払いはできません。受け取りにはウォレットが必要ですが、後から作成して受領することも可能です。
        </p>
      </section>

      {/* 作品の保護について */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-3">作品の保護と真正性</h2>
        <ul className="list-disc ml-6 space-y-2 text-sm">
          <li>表示用画像にはウォーターマークやAI学習阻害処理（例：Glaze）を適用。</li>
          <li>購入者には<strong>保護済み画像</strong>と<strong>原本</strong>の両方をお渡しします。</li>
          <li>NFT出展作品は、ブロックチェーン上で所有が証明されます。</li>
        </ul>
      </section>

      {/* よくある質問 */}
      <section className="mb-14">
        <h2 className="text-xl font-bold mb-3">よくあるご質問</h2>
        <ul className="space-y-4 text-sm">
          <li>
            <strong>Q. 支払い方法は？</strong><br />
            → クレジットカード（円）のみです。暗号資産での支払いには対応していません。
          </li>
          <li>
            <strong>Q. ウォレットがなくてもNFT作品を買えますか？</strong><br />
            → はい。まずはクレジットで購入し、<strong>後からウォレットを作成して受け取り</strong>できます（メールでご案内します）。
          </li>
          <li>
            <strong>Q. キャンセルや返品はできますか？</strong><br />
            → デジタル商品の性質上、原則キャンセルはできません。誤購入等は
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
