'use client';

import Link from 'next/link';

export default function DisclaimerPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">免責事項</h1>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
          me-ish（以下「当サービス」）の利用にあたり、以下の事項をご理解・ご同意のうえご利用ください。
        </p>
      </header>

      <article className="prose prose-neutral max-w-none leading-relaxed space-y-6">
        <h2 id="sec-1"><strong>第1条（情報の正確性）</strong></h2>
        <p>
          当サービスは、掲載情報の正確性・完全性・有用性を確保するよう努めますが、これを保証するものではありません。
          掲載情報に基づいて利用者に生じた損害について、当サービスは一切の責任を負いません。
        </p>

        <h2 id="sec-2"><strong>第2条（サービスの中断・停止）</strong></h2>
        <p>当サービスは、次の場合に事前の通知なくサービスの一部または全部を中断または停止することがあります。</p>
        <ul>
          <li>サーバートラブルやシステム障害が発生した場合</li>
          <li>自然災害、停電等の不可抗力による場合</li>
          <li>保守点検や運営上必要な場合</li>
        </ul>
        <p>これにより生じた損害についても、当サービスは一切の責任を負いません。</p>

        <h2 id="sec-3"><strong>第3条（出展作品の表示・管理）</strong></h2>
        <p>
          出展作品の管理・表示については適切な対応を行いますが、常時正常な動作・表示を保証するものではありません。
          サーバー障害や第三者による不正アクセス等により、一時的に表示や販売が停止する場合があります。
        </p>

        <h2 id="sec-4"><strong>第4条（第三者による損害）</strong></h2>
        <p>
          当サービス外部の第三者による行為（例：無断転載、スクリーンショット、NFT転売後のトラブル等）に起因して
          利用者や出展者に生じた損害について、当サービスは一切の責任を負いません。
        </p>

        <h2 id="sec-5"><strong>第5条（NFT・ブロックチェーン関連の免責）</strong></h2>
        <p>
          NFT販売においては、ブロックチェーンの仕様変更、ネットワーク混雑、第三者サービスの停止等により、
          取引やデータ移転に支障が生じる場合があります。これによる損害について、当サービスは責任を負いません。
        </p>

        <h2 id="sec-6"><strong>第6条（免責の範囲）</strong></h2>
        <p>
          当サービスは、当サービスに過失がない限り、直接的・間接的・付随的・特別損害を含むいかなる損害についても責任を負いません。
        </p>

        <h2 id="sec-7"><strong>第7条（お問い合わせ）</strong></h2>
        <p>
          本免責事項に関するお問い合わせは、
          <Link href="/contact" className="underline underline-offset-2">お問い合わせフォーム</Link>
          または <span>info [at] me-ish.art</span> までご連絡ください。
          （送信時は「[at]」を「@」に置換してください）
        </p>

        <p>制定日：2025年8月18日</p>
      </article>
    </main>
  );
}
