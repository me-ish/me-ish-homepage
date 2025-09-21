// app/footer/tokushoho/page.tsx
'use client';

import Link from 'next/link';

export default function TokushohoPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* ヘッダ */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">特定商取引法に基づく表記</h1>
        <p className="mt-2 text-sm text-gray-600">
          本表記は、オンラインギャラリー「me-ish」における作品の販売に関し、特定商取引法第11条に基づき必要な事項を表示するものです。
        </p>
      </header>

      <article className="prose prose-neutral max-w-none leading-relaxed space-y-6">
        <h2><strong>■ 販売事業者名</strong></h2>
        <p>me-ish（ミーイッシュ）</p>

        <h2><strong>■ 販売責任者</strong></h2>
        <p>大下　唯</p>

        <h2><strong>■ 所在地</strong></h2>
        <p>宮城県仙台市青葉区（詳細住所はご請求があった場合に遅滞なく開示します）</p>

        <h2><strong>■ 電話番号</strong></h2>
        <p>
          電話番号はご請求があった場合に遅滞なく開示いたします。<br />
          通常のお問い合わせは、下記のフォームまたはメールをご利用ください（電話でのサポートは行っておりません）。
        </p>

        <h2><strong>■ お問い合わせ先</strong></h2>
        <ul>
          <li>
            フォーム：
            <Link href="/contact" className="underline underline-offset-2">お問い合わせフォーム</Link>
          </li>
          <li>メール：<span>info [at] me-ish.art</span>（送信時は「@」に置換）</li>
        </ul>

        <h2><strong>■ サイトURL</strong></h2>
        <p>
          <a href="https://me-ish.art" target="_blank" rel="noopener noreferrer" className="underline">
            https://me-ish.art
          </a>
        </p>

        <h2><strong>■ 販売価格</strong></h2>
        <p>各作品ページに表示（<strong>消費税込／円表示（総額表示）</strong>）</p>

        <h2><strong>■ 商品代金以外の必要料金</strong></h2>
        <ul>
          <li>通信費（インターネット接続に係る料金等）</li>
          <li>
            NFT移転時のネットワーク手数料（ガス代）：
            原則<strong>当サービスが負担</strong>しますが、著しい高騰時は移転時期の調整またはご負担をお願いする場合があります
            （詳細は <Link href="/footer/terms#sec-8" className="underline">利用規約 第8条</Link> を参照）。
          </li>
        </ul>

        <h2><strong>■ お支払い方法</strong></h2>
        <ul>
          <li>クレジットカード決済（Stripe）／<strong>日本円のみ</strong></li>
          <li>暗号資産等による決済には対応していません。</li>
        </ul>

        <h2><strong>■ お支払い時期</strong></h2>
        <ul>
          <li>通常販売：購入手続き完了時に即時決済</li>
          <li>NFT販売：Stripe決済完了時に即時決済</li>
        </ul>

        <h2><strong>■ 商品の引渡時期・方法</strong></h2>
        <ul>
          <li>
            <strong>デジタル作品（通常販売）</strong>：
            決済確認後、<strong>即時〜24時間以内</strong>にダウンロードリンクまたはメールにて納品（システム障害等の場合は最長<strong>3営業日</strong>）。
          </li>
          <li>
            <strong>NFT作品（NFT販売）</strong>：
            決済確認後、当サービスがNFTを<strong>ミントして一旦保管</strong>します（原則<strong>72時間以内</strong>）。
            購入者がウォレットアドレスを登録した場合、<strong>原則7日以内</strong>に当該ウォレットへ移転します。
            NFTの受け取りは<strong>任意</strong>で、<strong>受取猶予は購入日から12か月</strong>です
            （詳細は <Link href="/footer/terms#sec-8" className="underline">利用規約 第8条</Link>）。
          </li>
        </ul>

        <h2><strong>■ 申込みの有効期限・販売数量の制限</strong></h2>
        <ul>
          <li>エディション数・販売期間等が設定されている場合は、各作品ページに表示します。</li>
        </ul>

        <h2><strong>■ 動作環境</strong></h2>
        <p>最新の主要ブラウザ（Chrome / Safari / Edge / Firefox）の現行サポート版での閲覧・購入を推奨します。</p>

        <h2><strong>■ 返品・キャンセル（返品特約）</strong></h2>
        <ul>
          <li>デジタル商品の性質上、<strong>購入確定後のキャンセル・返金は原則不可</strong>です。</li>
          <li>
            ただし、(i) 重複課金、(ii) 当サービスに起因する引渡不能・重大な欠陥があり合理的期間内に回復不能、
            (iii) 法令上の瑕疵がある場合は、<strong>購入後7日以内</strong>の申出に限り返金等に応じます。
          </li>
          <li>
            任意の「表示保証オプション」は<strong>1作品ごと</strong>に提供し、<strong>有効期間内に所定回数の表示</strong>を保証します。
            自動更新はありません。提供開始後および<strong>消化済み回数分は返金不可</strong>です
            （詳細は <Link href="/modal/pricing" className="underline">プランと料金</Link> ／
            <Link href="/footer/terms#sec-6" className="underline">利用規約 第6条</Link>）。
          </li>
          <li>通信販売にはクーリング・オフは適用されません。</li>
        </ul>

        <h2><strong>■ 表現および商品に関する注意書き</strong></h2>
        <p>各作品はアーティストによる創作物です。表現内容は主観的なものであり、効能・価値・転売価格等を保証するものではありません。</p>

        <p>制定日：2025年8月18日／改定日：2025年9月21日</p>
      </article>
    </main>
  );
}
