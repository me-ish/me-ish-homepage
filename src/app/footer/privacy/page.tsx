'use client';

import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* ヘッダ */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">プライバシーポリシー</h1>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
          me-ish（以下「当サービス」）は、利用者のプライバシーを尊重し、個人情報の適切な保護と管理を行います。
          本ポリシーは、当サービスにおける個人情報の取扱いについて定めるものです。
        </p>
      </header>

      {/* 目次 */}
      <aside className="mb-8 rounded-2xl border bg-gray-50 p-4 text-sm md:float-right md:ml-8 md:w-72">
        <div className="font-semibold">目次</div>
        <nav className="mt-2 grid gap-1">
          {[
            ['取得する情報', 'sec-1'],
            ['利用目的', 'sec-2'],
            ['第三者提供', 'sec-3'],
            ['外部サービスとの連携', 'sec-4'],
            ['Cookie等の利用', 'sec-5'],
            ['情報の管理', 'sec-6'],
            ['開示・訂正・削除等の請求', 'sec-7'],
            ['改定', 'sec-8'],
            ['お問い合わせ', 'sec-9'],
          ].map(([label, id]) => (
            <a
              key={id}
              href={`#${id}`}
              className="underline-offset-2 hover:underline"
            >
              {label}
            </a>
          ))}
        </nav>
      </aside>

      {/* 本文 */}
      <article className="prose prose-neutral max-w-none leading-relaxed space-y-6">
        <h2 id="sec-1">
          <strong>第1条（取得する情報）</strong>
        </h2>
        <p>当サービスでは、以下の情報を取得する場合があります：</p>
        <ul>
          <li>氏名（本名またはペンネーム）</li>
          <li>メールアドレス</li>
          <li>プロフィール情報（経歴、SNSリンク等）</li>
          <li>作品に関する情報（画像・ファイル・テキスト等）</li>
          <li>決済情報（Stripeを通じて取得）</li>
          <li>IPアドレス、ブラウザ種別、アクセス日時、閲覧履歴等</li>
        </ul>

        <h2 id="sec-2">
          <strong>第2条（利用目的）</strong>
        </h2>
        <p>取得した情報は、以下の目的で利用します：</p>
        <ul>
          <li>応募作品の確認・審査および連絡</li>
          <li>出展者への連絡および報酬支払い</li>
          <li>購入者への取引処理およびカスタマーサポート提供</li>
          <li>不正利用防止、セキュリティ対策、サービス改善</li>
          <li>法令に基づく対応</li>
        </ul>

        <h2 id="sec-3">
          <strong>第3条（第三者提供）</strong>
        </h2>
        <p>当サービスは、以下の場合を除き、本人の同意なく第三者に個人情報を提供しません：</p>
        <ul>
          <li>決済代行事業者（Stripe）との取引処理に必要な場合</li>
          <li>データベース管理（Supabase等）やサーバ運用等、業務委託に必要な場合</li>
          <li>法令に基づく開示義務がある場合</li>
          <li>人の生命、身体または財産の保護が必要な場合</li>
        </ul>

        <h2 id="sec-4">
          <strong>第4条（外部サービスとの連携）</strong>
        </h2>
        <p>当サービスでは、以下の外部サービスと連携する場合があります：</p>
        <ul>
          <li>Stripe（クレジットカード決済処理）</li>
          <li>Thirdweb（NFTの発行・移転処理）</li>
          <li>Supabase（応募情報・出展情報管理）</li>
          <li>Google Workspace（運営側での連絡管理）</li>
        </ul>
        <p>
          外部サービスにおける情報取扱いは、それぞれのプライバシーポリシーに従います。
        </p>

        <h2 id="sec-5">
          <strong>第5条（Cookie等の利用）</strong>
        </h2>
        <p>
          当サービスは、利便性向上・アクセス解析・不正防止のためCookie等を使用します。
          利用者はブラウザ設定によりCookieを無効化できますが、一部機能が利用できなくなる場合があります。
        </p>

        <h2 id="sec-6">
          <strong>第6条（情報の管理）</strong>
        </h2>
        <p>
          取得した情報は、漏洩・滅失・改ざん等を防止するため、適切なセキュリティ対策を講じて管理します。
          保管期間はサービス提供に必要な期間に限定し、不要となった場合は安全な方法で消去します。
        </p>
        <p>
          万一個人情報の漏洩等が発生した場合、速やかに原因究明・被害拡大防止措置を講じ、必要に応じて利用者及び関係機関へ通知します。
        </p>

        <h2 id="sec-7">
          <strong>第7条（開示・訂正・削除等の請求）</strong>
        </h2>
        <p>
          利用者は、自身に関する個人情報の開示、訂正、利用停止、削除を請求できます。
          ご希望の際は、
          <Link href="/contact" className="underline underline-offset-2">
            お問い合わせフォーム
          </Link>
          からご連絡ください。本人確認を行った上で、法令に基づき対応します。
        </p>

        <h2 id="sec-8">
          <strong>第8条（改定）</strong>
        </h2>
        <p>
          本ポリシーは、必要に応じて事前通知なく改定される場合があります。
          改定後は当サービス上に掲載された時点から効力を生じます。
          重要な改定についてはサイト上で告知します。
        </p>

        <h2 id="sec-9">
          <strong>第9条（お問い合わせ）</strong>
        </h2>
        <p>個人情報の取扱いに関するお問い合わせは、以下からご連絡ください。</p>
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
        <p className="mt-4">管理責任者：me-ish運営代表 大下唯</p>

        <p>制定日：2025年8月18日</p>
      </article>
    </main>
  );
}
