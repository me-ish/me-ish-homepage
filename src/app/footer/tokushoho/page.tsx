'use client';

import Link from 'next/link';

export default function TokushohoPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">特定商取引法に基づく表記</h1>
        <p className="mt-2 text-sm text-gray-600">
          この表記は、me-ish における作品の販売に関して、特定商取引法第11条に基づき必要な情報を記載したものです。
        </p>
      </header>

      <article className="prose prose-neutral max-w-none leading-relaxed space-y-6">
        <h2><strong>■ 販売事業者名</strong></h2>
        <p>me-ish（ミーイッシュ）</p>

        <h2><strong>■ 販売責任者</strong></h2>
        <p>大下　唯</p>

        <h2><strong>■ 所在地</strong></h2>
        <p>仙台市青葉区（詳細はご請求があった場合に遅滞なく開示します）</p>

        <h2><strong>■ 電話番号</strong></h2>
        <p>電話番号は特定商取引法第11条に基づき、ご請求があった場合に遅滞なく開示いたします。<br />
        お問い合わせは下記フォームまたはメールをご利用ください。</p>

        <h2><strong>■ お問い合わせ先</strong></h2>
        <ul>
          <li>
            フォーム：
            <Link href="/contact" className="underline underline-offset-2">
              お問い合わせフォーム
            </Link>
          </li>
          <li>
            メール：<span>info [at] me-ish.art</span>
          </li>
        </ul>
        <p className="text-sm text-gray-600 mt-2">
          ※メールアドレスはスパム防止のため「@」を「[at]」に置き換えています。
          送信時に「@」に置き換えてください。
        </p>

        <h2><strong>■ サイトURL</strong></h2>
        <p>
          <a href="https://me-ish.art" target="_blank" rel="noopener noreferrer" className="underline">
            https://me-ish.art
          </a>
        </p>

        <h2><strong>■ 販売価格</strong></h2>
        <p>各作品ページに記載（税込・円表示）</p>

        <h2><strong>■ 商品代金以外の必要料金</strong></h2>
        <ul>
          <li>消費税（価格に含まれます）</li>
          <li>通信費（インターネット接続料金など）</li>
          <li>Paperなどの決済手数料（NFT購入時のみ発生する場合あり）</li>
        </ul>

        <h2><strong>■ お支払い方法</strong></h2>
        <ul>
          <li>クレジットカード決済（Stripe）</li>
          <li>クレジットカード決済（StripeによるNFT購入）</li>
        </ul>

        <h2><strong>■ お支払い時期</strong></h2>
        <ul>
          <li>通常販売：購入手続き完了時に即時決済</li>
          <li>NFT販売：Stripe決済完了時に即時決済</li>
        </ul>

        <h2><strong>■ 商品の引渡時期</strong></h2>
        <ul>
          <li>デジタル作品：購入後、通常3営業日以内にダウンロードまたはメール納品</li>
          <li>NFT作品：購入完了後、ブロックチェーン上で即時移転（最大72時間以内）</li>
        </ul>

        <h2><strong>■ 返品・キャンセルについて</strong></h2>
        <p>デジタル商品の特性上、原則として返品・キャンセルはお受けできません。</p>
        <p>ただし、データ破損など当サービスに重大な瑕疵があった場合には、個別対応いたします。</p>

        <h2><strong>■ 表現および商品に関する注意書き</strong></h2>
        <p>各作品はアーティストによる創作物です。表現内容は主観的なものであり、品質・効果等を保証するものではありません。</p>

        <p>制定日：2025年8月18日</p>
      </article>
    </main>
  );
}
